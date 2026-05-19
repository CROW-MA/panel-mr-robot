import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

/* ===============================
   LISTAR CONVERSACIONES
================================= */
router.get("/", authenticate, async (req: AuthRequest, res) => {
  const businessId = req.user!.businessId;

  const { rows } = await pool.query(
    `
    SELECT * FROM conversations
    WHERE business_id=$1
    ORDER BY last_message_at DESC
    `,
    [businessId]
  );

  res.json(rows);
});

/* ===============================
   RESPUESTA HUMANA
================================= */
router.post("/reply", authenticate, async (req: AuthRequest, res) => {
  const { phone, message } = req.body;
  const businessId = req.user!.businessId;

  // Guardamos mensaje en tabla pending_messages
  await pool.query(
    `
    INSERT INTO human_messages (business_id, phone, message)
    VALUES ($1,$2,$3)
    `,
    [businessId, phone, message]
  );

  res.json({ message: "Mensaje enviado a cola del bot" });
});

export default router;
