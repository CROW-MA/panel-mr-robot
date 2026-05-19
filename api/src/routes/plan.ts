import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

// Listar todos los planes disponibles (público para el billing)
router.get("/list", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, price, max_conversations, max_agents, duration_days FROM plans ORDER BY price ASC"
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Error obteniendo planes" });
  }
});

// Upgrade de plan (legacy, se mantiene)
router.put("/upgrade", authenticate, async (req: AuthRequest, res) => {
  const businessId = req.user!.businessId;
  const { plan } = req.body;

  let messageLimit = 1000;
  if (plan === "pro") messageLimit = 10000;
  if (plan === "enterprise") messageLimit = 50000;

  await pool.query(
    "UPDATE businesses SET plan=$1, message_limit=$2 WHERE id=$3",
    [plan, messageLimit, businessId]
  );

  res.json({ message: "Plan actualizado" });
});

export default router;
