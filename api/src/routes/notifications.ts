import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";
import { createClient } from "redis";

const router = Router();

/* ── Redis subscriber para SSE ── */
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

/* ── STREAM SSE — notificaciones en tiempo real ── */
import jwt from "jsonwebtoken";
router.get("/stream", async (req: any, res) => {
  // Aceptar token por query string para SSE
  const token = req.query.token as string;
  if (!token) return res.status(401).end();
  let businessId: string;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "secret");
    businessId = decoded.businessId;
  } catch { return res.status(401).end(); }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Enviar ping cada 30s para mantener la conexión
  const ping = setInterval(() => {
    res.write("event: ping\ndata: {}\n\n");
  }, 30000);

  // Suscribir a Redis para este negocio
  const subscriber = createClient({ url: redisUrl });
  await subscriber.connect();

  const channel = `notifications:${businessId}`;
  await subscriber.subscribe(channel, (message) => {
    res.write(`event: notification\ndata: ${message}\n\n`);
  });

  // Limpiar cuando el cliente se desconecta
  req.on("close", async () => {
    clearInterval(ping);
    await subscriber.unsubscribe(channel);
    await subscriber.disconnect();
  });
});

/* ── LISTAR notificaciones del negocio ── */
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [businessId]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── CONTAR no leídas ── */
router.get("/unread-count", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE business_id = $1 AND read = false`,
      [businessId]
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── MARCAR una como leída ── */
router.put("/:id/read", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    await pool.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND business_id = $2`,
      [req.params.id, businessId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── MARCAR TODAS como leídas ── */
router.put("/read-all", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    await pool.query(
      `UPDATE notifications SET read = true WHERE business_id = $1`,
      [businessId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ELIMINAR una notificación ── */
router.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND business_id = $2`,
      [req.params.id, businessId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

