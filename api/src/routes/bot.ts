import { Router } from "express";
import axios from "axios";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";

const router = Router();
const BOT_URL = "http://127.0.0.1:3333";

/* GET CONFIG */
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { rows } = await pool.query(
      "SELECT * FROM bot_configs WHERE business_id=$1",
      [businessId]
    );
    res.json(rows[0] || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* UPDATE FLOW — guarda y recarga el bot de forma confiable */
router.put("/flow", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { flow_json } = req.body;

    if (!flow_json) {
      return res.status(400).json({ error: "flow_json es requerido" });
    }

    console.log(`💾 Guardando flow para: ${businessId}`);

    await pool.query(
      `INSERT INTO bot_configs (business_id, flow_json, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (business_id)
       DO UPDATE SET flow_json=$2, updated_at=NOW()`,
      [businessId, JSON.stringify(flow_json)]
    );

    console.log(`✅ Flow guardado en DB para: ${businessId}`);

    // Recargar el flow en el bot — con reintento si falla
    const reloadBot = async (attempt = 1): Promise<void> => {
      try {
        await axios.post(`${BOT_URL}/reload/${businessId}`, {}, { timeout: 5000 });
        console.log(`🔄 Flow recargado en bot para: ${businessId}`);
      } catch (err) {
        if (attempt < 3) {
          console.log(`⚠️ Reintento reload ${attempt}...`);
          await new Promise(r => setTimeout(r, 1000));
          await reloadBot(attempt + 1);
        } else {
          console.error(`❌ No se pudo recargar el bot después de 3 intentos`);
        }
      }
    };

    // No bloquear la respuesta al usuario — reload en background
    reloadBot().catch(console.error);

    res.json({ ok: true, message: "Flow actualizado y bot recargado" });
  } catch (err: any) {
    console.error("❌ UPDATE FLOW ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* QR */
router.get("/qr/:businessId", authenticate, async (req: AuthRequest, res) => {
  try {
    const response = await axios.get(`${BOT_URL}/qr/${req.params.businessId}`, { timeout: 5000 });
    res.json(response.data);
  } catch (err: any) {
    const data = err.response?.data || { error: "Error getting QR" };
    res.status(err.response?.status || 500).json(data);
  }
});

/* STATUS */
router.get("/status/:businessId", authenticate, async (req: AuthRequest, res) => {
  try {
    const response = await axios.get(`${BOT_URL}/status/${req.params.businessId}`, { timeout: 5000 });
    res.json(response.data);
  } catch {
    res.status(500).json({ error: "Error getting status" });
  }
});

/* START */
router.post("/start/:businessId", authenticate, async (req: AuthRequest, res) => {
  try {
    const response = await axios.post(`${BOT_URL}/start/${req.params.businessId}`, {}, { timeout: 5000 });
    res.json(response.data);
  } catch {
    res.status(500).json({ error: "Error starting bot" });
  }
});

/* RESTART */
router.post("/restart/:businessId", authenticate, async (req: AuthRequest, res) => {
  try {
    const response = await axios.post(`${BOT_URL}/restart/${req.params.businessId}`, {}, { timeout: 5000 });
    res.json(response.data);
  } catch {
    res.status(500).json({ error: "Error restarting bot" });
  }
});

router.post("/reset-session/:businessId", authenticate, async (req: AuthRequest, res) => {
  try {
    const { businessId } = req.params;
    if (req.user!.businessId !== businessId) return res.status(403).json({ error: "Sin permisos" });
    const response = await axios.post(`${BOT_URL}/reset-session/${businessId}`, {}, { timeout: 10000 });
    res.json(response.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.response?.data?.error || err.message });
  }
});

export default router;

