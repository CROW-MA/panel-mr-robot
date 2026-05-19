import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ================================================================
   EMAIL DE VERIFICACIÓN — se envía al registrarse
================================================================ */
export async function sendVerificationEmail(to: string, businessName: string, verifyUrl: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "MR.ROBOT COL <willgen18@gmail.com>",
    to,
    subject: "✅ Verifica tu email — MR.ROBOT COL",
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#00e676 0%,#00bcd4 100%);border-radius:16px 16px 0 0;padding:40px 40px 30px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🤖</div>
          <h1 style="margin:0;color:#0f0f0f;font-size:28px;font-weight:800;">MR.ROBOT COL</h1>
          <p style="margin:6px 0 0;color:#0f0f0f;font-size:12px;opacity:0.7;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Automatización WhatsApp Colombia</p>
        </td></tr>
        <!-- BODY -->
        <tr><td style="background:#1a1a1a;padding:40px;">
          <h2 style="margin:0 0 6px;color:#ffffff;font-size:22px;font-weight:700;">Hola, ${businessName} 👋</h2>
          <p style="margin:0 0 24px;color:#aaaaaa;font-size:15px;line-height:1.7;">
            Gracias por registrarte. Para activar tu cuenta y comenzar a usar el bot, necesitas verificar tu correo electrónico.
          </p>
          <!-- BOTÓN -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center">
              <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#00e676,#00bcd4);color:#0f0f0f;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:800;font-size:16px;letter-spacing:0.5px;">
                ✅ Verificar mi email
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;color:#666;font-size:13px;">Si el botón no funciona, copia este enlace en tu navegador:</p>
          <p style="margin:0 0 24px;color:#00e676;font-size:12px;word-break:break-all;">${verifyUrl}</p>
          <div style="background:#242424;border-radius:10px;padding:16px;border-left:4px solid #f59e0b;">
            <p style="margin:0;color:#f59e0b;font-size:13px;">⚠️ Este enlace expira en 24 horas. Si no solicitaste esta cuenta, ignora este email.</p>
          </div>
        </td></tr>
        <!-- FOOTER -->
        <tr><td style="background:#111;border-radius:0 0 16px 16px;padding:24px;text-align:center;">
          <p style="margin:0;color:#555;font-size:12px;">© 2026 MR.ROBOT COL — Automatización WhatsApp Colombia</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  });
}

/* ================================================================
   EMAIL DE BIENVENIDA — se envía al verificar el email
================================================================ */
export async function sendWelcomeEmail(to: string, businessName: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "MR.ROBOT COL <willgen18@gmail.com>",
    to,
    subject: `🎉 ¡Bienvenido a MR.ROBOT COL, ${businessName}!`,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#00e676 0%,#00bcd4 100%);border-radius:16px 16px 0 0;padding:40px 40px 30px;text-align:center;">
          <div style="font-size:48px;margin-bottom:8px;">🤖</div>
          <h1 style="margin:0;color:#0f0f0f;font-size:28px;font-weight:800;">MR.ROBOT COL</h1>
          <p style="margin:6px 0 0;color:#0f0f0f;font-size:12px;opacity:0.7;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Automatización WhatsApp Colombia</p>
        </td></tr>
        <!-- BODY -->
        <tr><td style="background:#1a1a1a;padding:40px;">
          <h2 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;">¡Bienvenido, ${businessName}! 🎉</h2>
          <p style="margin:0 0 28px;color:#aaaaaa;font-size:15px;line-height:1.7;">Tu cuenta está activa. Estás a minutos de automatizar tu WhatsApp y escalar tu negocio las 24 horas del día.</p>
          <!-- PASOS -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#242424;border-radius:12px;padding:18px 20px;border-left:4px solid #00e676;margin-bottom:10px;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td valign="middle" style="padding-right:14px;">
                  <div style="background:#00e676;color:#0f0f0f;width:30px;height:30px;border-radius:50%;text-align:center;line-height:30px;font-weight:800;font-size:14px;">1</div>
                </td>
                <td>
                  <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">Conecta tu WhatsApp</p>
                  <p style="margin:4px 0 0;color:#888;font-size:13px;">Panel → Conexiones → Escanea el código QR</p>
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="height:10px;"></td></tr>
            <tr><td style="background:#242424;border-radius:12px;padding:18px 20px;border-left:4px solid #00bcd4;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td valign="middle" style="padding-right:14px;">
                  <div style="background:#00bcd4;color:#0f0f0f;width:30px;height:30px;border-radius:50%;text-align:center;line-height:30px;font-weight:800;font-size:14px;">2</div>
                </td>
                <td>
                  <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">Configura tu Bot</p>
                  <p style="margin:4px 0 0;color:#888;font-size:13px;">Personaliza los flujos y mensajes automáticos</p>
                </td>
              </tr></table>
            </td></tr>
            <tr><td style="height:10px;"></td></tr>
            <tr><td style="background:#242424;border-radius:12px;padding:18px 20px;border-left:4px solid #a855f7;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td valign="middle" style="padding-right:14px;">
                  <div style="background:#a855f7;color:#fff;width:30px;height:30px;border-radius:50%;text-align:center;line-height:30px;font-weight:800;font-size:14px;">3</div>
                </td>
                <td>
                  <p style="margin:0;color:#ffffff;font-size:14px;font-weight:700;">¡Empieza a vender!</p>
                  <p style="margin:4px 0 0;color:#888;font-size:13px;">Tu bot responde 24/7 mientras tú creces</p>
                </td>
              </tr></table>
            </td></tr>
          </table>
          <!-- TRIAL -->
          <div style="background:#1a2a1a;border:1px solid #00e676;border-radius:12px;padding:18px 20px;margin-top:24px;text-align:center;">
            <p style="margin:0;color:#00e676;font-size:16px;font-weight:800;">🎁 30 días de prueba GRATIS</p>
            <p style="margin:6px 0 0;color:#888;font-size:13px;">200 conversaciones incluidas. Sin tarjeta de crédito.</p>
          </div>
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
            <tr><td align="center">
              <a href="https://panel.shoppyworld.site" style="display:inline-block;background:linear-gradient(135deg,#00e676,#00bcd4);color:#0f0f0f;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:800;font-size:16px;">
                Ir al panel →
              </a>
            </td></tr>
          </table>
        </td></tr>
        <!-- FOOTER -->
        <tr><td style="background:#111;border-radius:0 0 16px 16px;padding:24px;text-align:center;">
          <p style="margin:0;color:#555;font-size:12px;">© 2026 MR.ROBOT COL — Automatización WhatsApp Colombia</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  });
}

