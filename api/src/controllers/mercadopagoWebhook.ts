import { Request, Response } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Nuevo cliente Mercado Pago
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export const mercadopagoWebhook = async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    if (type !== "payment") {
      return res.status(200).json({ ok: true });
    }

    const paymentClient = new Payment(mpClient);
    let payment;

    try {
      payment = await paymentClient.get({ id: data.id });
    } catch (err) {
      console.log("Pago no encontrado (probablemente prueba manual)");
      return res.status(200).json({ ok: true });
    }

    const customerEmail = payment.payer?.email;

    if (!customerEmail) {
      return res.status(200).json({ ok: true });
    }

    // Buscar empresa por email del usuario dueño
    const { rows } = await pool.query(
      `
      SELECT b.id
      FROM businesses b
      JOIN users u ON b.id = u.business_id
      WHERE u.email = $1
      LIMIT 1
      `,
      [customerEmail]
    );

    const business = rows[0];
    if (!business) {
      return res.status(200).json({ ok: true });
    }

    // ✅ PAGO APROBADO
    if (payment.status === "approved") {
      await pool.query(
        `
        UPDATE businesses
        SET subscription_status = 'active',
            is_active = true,
            billing_cycle_start = NOW(),
            messages_used = 0
        WHERE id = $1
        `,
        [business.id]
      );
    }

    // ❌ PAGO FALLIDO
    if (payment.status === "rejected") {
      await pool.query(
        `
        UPDATE businesses
        SET subscription_status = 'past_due'
        WHERE id = $1
        `,
        [business.id]
      );
    }

    return res.status(200).json({ ok: true });

  } catch (error: any) {
    console.error("MP WEBHOOK ERROR:", error.message);
    return res.status(500).json({ error: "Webhook error" });
  }
};
