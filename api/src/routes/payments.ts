import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";
import { pool } from "../db";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const router = Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN as string,
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);

router.post("/create", authenticate, async (req: AuthRequest, res) => {
  try {
    const { plan_id } = req.body;
    const businessId = req.user!.businessId;

    const planData = await pool.query(
      "SELECT * FROM plans WHERE id=$1",
      [plan_id]
    );

    const plan = planData.rows[0];
    if (!plan) return res.status(404).json({ error: "Plan no encontrado" });

    const preference = await preferenceClient.create({
      body: {
        items: [{ id: String(plan.id), title: `Plan ${plan.name}`, unit_price: Number(plan.price), quantity: 1 }],
        back_urls: {
          success: "https://shoppyworld.site/success",
          failure: "https://shoppyworld.site/failure",
        },
        notification_url: "https://api.shoppyworld.site/payments/webhook",
        metadata: { business_id: businessId, plan_id: plan.id },
      },
    });

    res.json({ init_point: preference.init_point });
  } catch (error: any) {
    console.error("Error creando pago:", error.message);
    res.status(500).json({ error: "Error creando pago" });
  }
});

router.post("/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type !== "payment" || !data?.id) return res.sendStatus(200);

    const payment = await paymentClient.get({ id: data.id });
    if (payment.status !== "approved") return res.sendStatus(200);

    const metadata = payment.metadata;
    if (!metadata?.business_id || !metadata?.plan_id) return res.sendStatus(200);

    const planResult = await pool.query("SELECT duration_days FROM plans WHERE id=$1", [metadata.plan_id]);
    const plan = planResult.rows[0];
    if (!plan || !plan.duration_days) return res.sendStatus(200);

    // 🔥 SUSCRIPCIÓN ACUMULATIVA
    const businessResult = await pool.query(
      "SELECT subscription_end FROM businesses WHERE id=$1",
      [metadata.business_id]
    );
    const business = businessResult.rows[0];
    let startDate = new Date();
    if (business?.subscription_end && new Date(business.subscription_end) > startDate) {
      startDate = new Date(business.subscription_end);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration_days);

    await pool.query(
      `
      UPDATE businesses
      SET plan_id=$1, subscription_status='active', is_active=true,
          billing_cycle_start=NOW(),
          subscription_end=$2
      WHERE id=$3
      `,
      [metadata.plan_id, endDate, metadata.business_id]
    );

    console.log("PLAN ACTIVADO / REACTIVADO:", metadata.business_id);
    res.sendStatus(200);
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    res.sendStatus(200);
  }
});

export default router;
