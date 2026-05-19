import { Router } from "express";
import { pool } from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { sendWelcomeEmail, sendVerificationEmail } from "../services/mailer";

const router = Router();
const BOT_URL = "http://127.0.0.1:3333";
const BASE_URL = process.env.BASE_URL || "https://api.shoppyworld.site";

/* ======================
   REGISTER
====================== */
router.post("/register", async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, business_name } = req.body;

    if (!email || !password || !business_name) {
      return res.status(400).json({ error: "Email, contraseña y nombre de empresa son requeridos" });
    }

    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "El email ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    const newUser = await client.query(
      `INSERT INTO users (email, password, role, email_verified, verification_token)
       VALUES ($1,$2,'admin',false,$3) RETURNING id`,
      [email, hashedPassword, verificationToken]
    );
    const userId = newUser.rows[0].id;

    const clientId = "client_" + uuidv4().replace(/-/g, "").slice(0, 16);

    const trialPlan = await client.query("SELECT id FROM plans WHERE name='Trial' LIMIT 1");
    const planId = trialPlan.rows[0]?.id ?? null;

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    const newBusiness = await client.query(
      `INSERT INTO businesses
         (name, whatsapp_number, owner_id, client_id, is_active,
          plan_id, subscription_status, trial_ends_at, subscription_end,
          message_limit, messages_used)
       VALUES ($1,$2,$3,$4,true,$5,'trial',$6,$7,200,0)
       RETURNING id`,
      [business_name, `temp_${Date.now()}`, userId, clientId, planId, trialEnd, trialEnd]
    );
    const businessId = newBusiness.rows[0].id;

    await client.query("UPDATE users SET business_id=$1 WHERE id=$2", [businessId, userId]);

    await client.query(
      `INSERT INTO bot_configs (business_id, flow_json) VALUES ($1,$2)`,
      [businessId, JSON.stringify({
        steps: [
          {
            id: "start",
            type: "menu",
            message: "👋 Hola, bienvenido. ¿En qué podemos ayudarte?\n\n1️⃣ Servicios\n2️⃣ Horarios\n3️⃣ Ubicación\n4️⃣ Hablar con asesor\n\nEscribe el número de tu opción.",
            next: { "1": "servicios", "2": "horarios", "3": "ubicacion", "4": "asesor" },
          },
          { id: "servicios", type: "message", message: "🛠 Nuestros servicios:\n\n- Servicio 1\n- Servicio 2\n\nEscribe *menu* para volver.", next: {} },
          { id: "horarios",  type: "message", message: "🕒 Horario de atención:\nLunes a Viernes 8:00 AM - 6:00 PM\n\nEscribe *menu* para volver.", next: {} },
          { id: "ubicacion", type: "location", message: "📍 Estamos ubicados en:\n\nEscribe *menu* para volver.", metadata: { address: "", maps_url: "" }, next: {} },
          { id: "asesor",    type: "human",   message: "👨‍💼 Un asesor se comunicará contigo en breve.", metadata: { agent_name: "" }, next: {} },
        ],
      })]
    );

    await client.query("COMMIT");

    // Enviar email de verificación
    const verifyUrl = `${BASE_URL}/auth/verify-email?token=${verificationToken}`;
    try {
      await sendVerificationEmail(email, business_name, verifyUrl);
      console.log(`📧 Email de verificación enviado a: ${email}`);
    } catch (mailErr: any) {
      console.warn(`⚠️ Email no enviado: ${mailErr?.message}`);
    }

    // Auto-start bot (en background)
    axios.post(`${BOT_URL}/start/${businessId}`, {}, { timeout: 5000 }).catch(() => {});

    res.json({
      message: "Cuenta creada. Revisa tu correo para verificar tu email antes de iniciar sesión.",
      emailSent: true,
    });

  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("REGISTER ERROR:", error.message);
    res.status(500).json({ error: "Error del servidor" });
  } finally {
    client.release();
  }
});

/* ======================
   VERIFY EMAIL
====================== */
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send(verifyPage("error", "Token inválido."));

    const result = await pool.query(
      "SELECT id, email, business_id FROM users WHERE verification_token=$1 AND email_verified=false",
      [token]
    );

    if (!result.rows[0]) {
      return res.status(400).send(verifyPage("error", "El link ya fue usado o es inválido."));
    }

    const user = result.rows[0];
    await pool.query(
      "UPDATE users SET email_verified=true, verification_token=NULL WHERE id=$1",
      [user.id]
    );

    // Enviar email de bienvenida ahora que está verificado
    try {
      const biz = await pool.query("SELECT name FROM businesses WHERE id=$1", [user.business_id]);
      if (biz.rows[0]) await sendWelcomeEmail(user.email, biz.rows[0].name);
    } catch {}

    console.log(`✅ Email verificado: ${user.email}`);
    res.send(verifyPage("success", "¡Tu cuenta está activa! Ya puedes iniciar sesión."));

  } catch (error: any) {
    console.error("VERIFY ERROR:", error.message);
    res.status(500).send(verifyPage("error", "Error del servidor. Intenta de nuevo."));
  }
});

/* Página HTML de verificación */
function verifyPage(type: "success" | "error", message: string): string {
  const isSuccess = type === "success";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Verificación — MR.ROBOT COL</title>
<style>
  body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#0f0f0f;display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .card{background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:48px 40px;text-align:center;max-width:400px;width:90%;}
  .icon{font-size:56px;margin-bottom:16px;}
  h1{color:#fff;font-size:24px;margin:0 0 12px;}
  p{color:#aaa;font-size:15px;line-height:1.6;margin:0 0 28px;}
  a{display:inline-block;background:${isSuccess?"#16a34a":"#374151"};color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;}
</style></head>
<body>
  <div class="card">
    <div class="icon">${isSuccess?"✅":"❌"}</div>
    <h1>${isSuccess?"¡Email verificado!":"Error de verificación"}</h1>
    <p>${message}</p>
    <a href="https://panel.shoppyworld.site">Ir al panel →</a>
  </div>
</body></html>`;
}

/* ======================
   LOGIN
====================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Credenciales inválidas" });

    // Verificar que el email esté confirmado
    if (!user.email_verified) {
      return res.status(403).json({
        error: "Debes verificar tu email antes de iniciar sesión. Revisa tu correo.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    if (!user.business_id) {
      return res.status(403).json({ error: "Usuario sin empresa asignada" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, businessId: user.business_id },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role, businessId: user.business_id } });

  } catch (error: any) {
    console.error("LOGIN ERROR:", error.message);
    res.status(500).json({ error: "Error del servidor" });
  }
});

/* ======================
   REENVIAR VERIFICACIÓN
====================== */
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });

    const result = await pool.query(
      "SELECT id, email_verified, business_id FROM users WHERE email=$1",
      [email]
    );
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: "Email no encontrado" });
    if (user.email_verified) return res.status(400).json({ error: "El email ya está verificado" });

    const newToken = uuidv4();
    await pool.query("UPDATE users SET verification_token=$1 WHERE id=$2", [newToken, user.id]);

    const biz = await pool.query("SELECT name FROM businesses WHERE id=$1", [user.business_id]);
    const bizName = biz.rows[0]?.name || "tu empresa";
    const verifyUrl = `${BASE_URL}/auth/verify-email?token=${newToken}`;

    await sendVerificationEmail(email, bizName, verifyUrl);
    res.json({ message: "Email de verificación reenviado" });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   ME
====================== */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Sin token" });

    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

    const result = await pool.query(
      "SELECT id, email, role, business_id FROM users WHERE id=$1",
      [decoded.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({ id: user.id, email: user.email, role: user.role, businessId: user.business_id });
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
});

export default router;

