import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

/* ── LISTAR CITAS ── */
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { date } = req.query;
    let query = `SELECT * FROM appointments WHERE business_id=$1`;
    const params: any[] = [businessId];
    if (date) { query += ` AND appointment_date=$2`; params.push(date); }
    query += ` ORDER BY appointment_date ASC, appointment_time ASC`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ── PRÓXIMO HORARIO DISPONIBLE ── */
router.get("/next-slot", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const duration = parseInt(req.query.duration as string) || 30;

    const now = new Date();
    const startHour = 8;
    const endHour = 20;

    // Buscar citas de hoy y mañana
    const { rows: existing } = await pool.query(
      `SELECT appointment_date, appointment_time, duration_minutes
       FROM appointments
       WHERE business_id=$1
         AND appointment_date >= CURRENT_DATE
         AND status != 'cancelled'
       ORDER BY appointment_date, appointment_time`,
      [businessId]
    );

    // Construir slots ocupados
    const occupied = new Set<string>();
    for (const appt of existing) {
      const d = appt.appointment_date.toISOString().split("T")[0];
      const [h, m] = appt.appointment_time.split(":");
      const startMin = parseInt(h) * 60 + parseInt(m);
      const dur = appt.duration_minutes || 30;
      for (let i = 0; i < dur; i += 30) {
        const totalMin = startMin + i;
        const hh = Math.floor(totalMin / 60).toString().padStart(2, "0");
        const mm = (totalMin % 60).toString().padStart(2, "0");
        occupied.add(`${d}_${hh}:${mm}`);
      }
    }

    // Encontrar próximo slot libre
    let checkDate = new Date(now);
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dateStr = checkDate.toISOString().split("T")[0];
      const startMin = dayOffset === 0
        ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 30) / 30) * 30
        : startHour * 60;

      for (let min = startMin; min < endHour * 60; min += 30) {
        const hh = Math.floor(min / 60).toString().padStart(2, "0");
        const mm = (min % 60).toString().padStart(2, "0");
        const slotKey = `${dateStr}_${hh}:${mm}`;
        let slotFree = true;
        for (let i = 0; i < duration; i += 30) {
          const totalMin = min + i;
          const sh = Math.floor(totalMin / 60).toString().padStart(2, "0");
          const sm = (totalMin % 60).toString().padStart(2, "0");
          if (occupied.has(`${dateStr}_${sh}:${sm}`)) { slotFree = false; break; }
        }
        if (slotFree) {
          return res.json({ date: dateStr, time: `${hh}:${mm}`, available: true });
        }
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }

    res.json({ available: false, message: "No hay disponibilidad en los próximos 7 días" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ── CREAR CITA ── */
router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { client_phone, client_name, service, appointment_date, appointment_time, duration_minutes, notes } = req.body;

    if (!client_phone || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    // Verificar que el slot esté libre
    const { rows: conflict } = await pool.query(
      `SELECT id FROM appointments
       WHERE business_id=$1 AND appointment_date=$2 AND appointment_time=$3 AND status!='cancelled'`,
      [businessId, appointment_date, appointment_time]
    );

    if (conflict.length > 0) {
      return res.status(409).json({ error: "Ese horario ya está ocupado" });
    }

    const { rows } = await pool.query(
      `INSERT INTO appointments (business_id, client_phone, client_name, service, appointment_date, appointment_time, duration_minutes, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [businessId, client_phone, client_name, service, appointment_date, appointment_time, duration_minutes || 30, notes]
    );

    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ── ACTUALIZAR ESTADO ── */
router.put("/:id/status", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { status } = req.body;
    await pool.query(
      `UPDATE appointments SET status=$1 WHERE id=$2 AND business_id=$3`,
      [status, req.params.id, businessId]
    );
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ── ELIMINAR CITA ── */
router.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    await pool.query(`DELETE FROM appointments WHERE id=$1 AND business_id=$2`, [req.params.id, businessId]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;

