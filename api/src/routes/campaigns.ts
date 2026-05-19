import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";
import axios from "axios";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();
const BOT_URL = "http://127.0.0.1:3333";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, "../../public/campaigns");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `campaign_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/3gpp","application/pdf","audio/mpeg","audio/ogg"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo de archivo no permitido"));
  },
});

router.post("/upload", authenticate, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });
    const baseUrl = process.env.BASE_URL || "https://api.shoppyworld.site";
    const fileUrl = `${baseUrl}/campaigns/${req.file.filename}`;
    res.json({ ok: true, url: fileUrl, type: req.file.mimetype, name: req.file.originalname });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/send", authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, message, phones, mediaUrl, mediaType } = req.body;
    const businessId = req.user!.businessId;

    if (!name || !phones?.length) return res.status(400).json({ error: "Faltan datos requeridos" });
    if (!message && !mediaUrl) return res.status(400).json({ error: "Debes escribir un mensaje o adjuntar un archivo" });

    const { rows: bizRows } = await pool.query(
      "SELECT messages_used, message_limit FROM businesses WHERE id=$1", [businessId]
    );
    const biz = bizRows[0];
    if (!biz) return res.status(404).json({ error: "Empresa no encontrada" });

    const available = biz.message_limit - biz.messages_used;
    if (available < phones.length) {
      return res.status(400).json({ error: `No tienes suficientes mensajes. Tienes ${available} disponibles y necesitas ${phones.length}.` });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const phone of phones) {
      try {
        await axios.post(`${BOT_URL}/send-message`, {
          businessId,
          phone: phone.replace(/\D/g, ""),
          message: message || "",
          mediaUrl: mediaUrl || null,
          caption: message || "",
        }, { timeout: 15000 });
        sent++;
        await new Promise(r => setTimeout(r, 1500));
      } catch (err: any) {
        errors.push(`+${phone}: ${err?.response?.data?.error || err?.message}`);
      }
    }

    await pool.query("UPDATE businesses SET messages_used = messages_used + $1 WHERE id=$2", [sent, businessId]);
    res.json({ ok: true, sent, failed: errors.length, errors: errors.slice(0, 5) });

  } catch (err: any) {
    console.error("Campaign error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

