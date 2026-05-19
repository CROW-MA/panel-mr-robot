import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

/* ================================================================
   STORAGE — LOGO
================================================================ */
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, "../../public/logos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req: any, file, cb) => {
    const businessId = req.user?.businessId || "unknown";
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${businessId}${ext}`);
  },
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se permiten imágenes JPG, PNG o WebP"));
  },
});

/* ================================================================
   STORAGE — MENU FILE (PDF / imagen)
================================================================ */
const menuStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, "../../public/menus");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req: any, file, cb) => {
    const businessId = req.user?.businessId || "unknown";
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `menu_${businessId}${ext}`);
  },
});

const uploadMenu = multer({
  storage: menuStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/webp", "image/jpg",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se permiten imágenes (JPG, PNG, WebP) o PDF"));
  },
});

/* ================================================================
   GET business info
================================================================ */
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, whatsapp_number, logo_url, menu_file_url FROM businesses WHERE id=$1",
      [req.user!.businessId]
    );
    res.json(rows[0] || {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================
   UPLOAD LOGO
================================================================ */
router.post(
  "/logo",
  authenticate,
  (req, res, next) => {
    uploadLogo.single("logo")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "El archivo excede 2MB" : err.message });
      }
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se recibió ninguna imagen" });

      // Eliminar logo anterior si existe y es diferente
      const { rows: prev } = await pool.query(
        "SELECT logo_url FROM businesses WHERE id=$1",
        [req.user!.businessId]
      );
      if (prev[0]?.logo_url) {
        const oldFile = path.join(__dirname, "../../public/logos", path.basename(prev[0].logo_url));
        if (fs.existsSync(oldFile) && oldFile !== path.join(__dirname, "../../public/logos", req.file.filename)) {
          try { fs.unlinkSync(oldFile); } catch {}
        }
      }

      const baseUrl = process.env.BASE_URL || "https://api.shoppyworld.site";
      const logoUrl = `${baseUrl}/logos/${req.file.filename}`;

      await pool.query(
        "UPDATE businesses SET logo_url=$1 WHERE id=$2",
        [logoUrl, req.user!.businessId]
      );

      res.json({ ok: true, logo_url: logoUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ================================================================
   DELETE LOGO
================================================================ */
router.delete("/logo", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { rows } = await pool.query(
      "SELECT logo_url FROM businesses WHERE id=$1",
      [businessId]
    );
    if (rows[0]?.logo_url) {
      const filepath = path.join(__dirname, "../../public/logos", path.basename(rows[0].logo_url));
      if (fs.existsSync(filepath)) { try { fs.unlinkSync(filepath); } catch {} }
    }
    await pool.query("UPDATE businesses SET logo_url=NULL WHERE id=$1", [businessId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================================
   UPLOAD MENU FILE
================================================================ */
router.post(
  "/menu-file",
  authenticate,
  (req, res, next) => {
    uploadMenu.single("menu_file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "El archivo excede 10MB" : err.message });
      }
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

      // Eliminar archivo anterior si existe
      const { rows: prev } = await pool.query(
        "SELECT menu_file_url FROM businesses WHERE id=$1",
        [req.user!.businessId]
      );
      if (prev[0]?.menu_file_url) {
        const oldFile = path.join(__dirname, "../../public/menus", path.basename(prev[0].menu_file_url));
        if (fs.existsSync(oldFile)) { try { fs.unlinkSync(oldFile); } catch {} }
      }

      const baseUrl       = process.env.BASE_URL || "https://api.shoppyworld.site";
      const menuFileUrl   = `${baseUrl}/menus/${req.file.filename}`;

      await pool.query(
        "UPDATE businesses SET menu_file_url=$1 WHERE id=$2",
        [menuFileUrl, req.user!.businessId]
      );

      res.json({ ok: true, menu_file_url: menuFileUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ================================================================
   DELETE MENU FILE
================================================================ */
router.delete("/menu-file", authenticate, async (req: AuthRequest, res) => {
  try {
    const businessId = req.user!.businessId;
    const { rows } = await pool.query(
      "SELECT menu_file_url FROM businesses WHERE id=$1",
      [businessId]
    );
    if (rows[0]?.menu_file_url) {
      const filepath = path.join(__dirname, "../../public/menus", path.basename(rows[0].menu_file_url));
      if (fs.existsSync(filepath)) { try { fs.unlinkSync(filepath); } catch {} }
    }
    await pool.query("UPDATE businesses SET menu_file_url=NULL WHERE id=$1", [businessId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

