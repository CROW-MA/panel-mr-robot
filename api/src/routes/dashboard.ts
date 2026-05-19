import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";
import { pool } from "../db";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;

    const businessResult = await pool.query(
      `SELECT id, name, type, is_active, subscription_status, billing_cycle_start, subscription_end, plan_id, message_limit, messages_used
       FROM businesses WHERE id=$1`,
      [businessId]
    );
    const business = businessResult.rows[0];
    if (!business) return res.status(404).json({ error: "Empresa no encontrada" });

    const planResult = await pool.query(
      `SELECT id, name, price, duration_days FROM plans WHERE id=$1`,
      [business.plan_id]
    );
    const plan = planResult.rows[0] || null;

    let daysRemaining = 0;
    if (business.subscription_end) {
      const now = new Date();
      const endDate = new Date(business.subscription_end);
      daysRemaining = Math.max(Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)), 0);
    }

    res.json({
      business: { ...business, days_remaining: daysRemaining },
      plan,
    });
  } catch (err: any) {
    console.error("Dashboard error:", err.message);
    res.status(500).json({ error: "Error obteniendo datos del dashboard" });
  }
});

export default router;
