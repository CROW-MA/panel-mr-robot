import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import dotenv from "dotenv";
import express from "express";
import { execSync } from "child_process";
import { pool } from "./db";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "redis";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisPublisher = createClient({ url: redisUrl });
redisPublisher.connect().catch(console.error);

const clients:   Record<string, Client> = {};
const qrCodes:   Record<string, string> = {};
const botStatus: Record<string, "starting" | "qr" | "online" | "offline" | "error"> = {};
const starting:  Set<string> = new Set();
const flowCache: Record<string, any> = {};
let launchQueue: Promise<void> = Promise.resolve();

process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException",  (err) => console.error("uncaughtException:",  err));

/* ================================================================
   UTILS
================================================================ */
function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, "").trim();
}

function parseFlow(flowJson: any): any {
  try { return typeof flowJson === "string" ? JSON.parse(flowJson) : flowJson; }
  catch { return null; }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanSessionLocks(clientId: string): void {
  const p = `/opt/waas/bot/sessions/session-${clientId}`;
  try {
    execSync(
      `rm -f "${p}/SingletonLock" "${p}/SingletonCookie" "${p}/SingletonSocket" "${p}/DevToolsActivePort"`,
      { stdio: "ignore" }
    );
  } catch {}
  try { execSync(`rm -rf /tmp/com.google.Chrome.*`, { stdio: "ignore" }); } catch {}
}

function matchOption(
  userText: string,
  normalized: string,
  options: Record<string, string>
): string | null {
  const keys = Object.keys(options);
  for (const key of keys) {
    if (normalizeText(key) === normalized || key === userText) return options[key];
    const m = key.match(/^(\d+)/);
    if (m && m[1] === normalized) return options[key];
  }
  const idx = parseInt(normalized, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= keys.length) return options[keys[idx - 1]];
  return null;
}

type StepType = "menu" | "message" | "location" | "link" | "agenda" | "human" | "collect";

function getStepType(step: any): StepType {
  if (step.type) return step.type as StepType;
  const id = step.id.toLowerCase();
  if (["ubicacion","ubicación","location","direccion"].some(k => id.includes(k))) return "location";
  if (["asesor","human","humano","agente","soporte"].some(k => id.includes(k)))    return "human";
  if (["agend","cita","reserva","turno"].some(k => id.includes(k)))                return "agenda";
  if (["tienda","link","web","catalogo","url"].some(k => id.includes(k)))          return "link";
  if (Object.keys(step.next || {}).length > 0)                                    return "menu";
  return "message";
}

/* ================================================================
   DB HELPERS
================================================================ */
async function getActiveBusinesses() {
  const { rows } = await pool.query(
    "SELECT id, name, client_id, whatsapp_number FROM businesses WHERE is_active = true"
  );
  return rows;
}

async function getBotFlow(businessId: string): Promise<any> {
  if (flowCache[businessId]) return flowCache[businessId];
  const { rows } = await pool.query(
    "SELECT flow_json FROM bot_configs WHERE business_id = $1",
    [businessId]
  );
  if (!rows[0]) return null;
  const flow = parseFlow(rows[0].flow_json);
  if (flow) flowCache[businessId] = flow;
  return flow;
}

function reloadFlow(businessId: string): void {
  delete flowCache[businessId];
  console.log(`🔄 Flow recargado: ${businessId}`);
}

async function createNotification(
  businessId: string,
  type: string,
  title: string,
  body: string,
  phone: string
): Promise<void> {
  try {
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO notifications (id, business_id, type, title, body, phone)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, businessId, type, title, body, phone]
    );
    if (rows[0]) {
      await redisPublisher
        .publish(`notifications:${businessId}`, JSON.stringify(rows[0]))
        .catch(() => {});
    }
  } catch (err) { console.error("❌ Notificación error:", err); }
}

async function notifyOwner(
  business: { id: string; name: string; whatsapp_number: string },
  clientPhone: string,
  type: "human" | "agenda",
  extra?: string
): Promise<void> {
  try {
    const ownerClient = clients[business.id];
    if (!ownerClient || botStatus[business.id] !== "online") return;
    const ownerNumber = business.whatsapp_number.replace(/\D/g, "");
    if (!ownerNumber || ownerNumber === clientPhone) return;
    const now = new Date().toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const msg =
      type === "agenda"
        ? `📅 *Nueva solicitud de cita*\n\n🏢 *Negocio:* ${business.name}\n📱 *Cliente:* +${clientPhone}\n🕐 *Hora:* ${now}${extra ? `\n📋 *Detalle:* ${extra}` : ""}\n\n👉 https://wa.me/${clientPhone}`
        : `👤 *Cliente solicita asesor*\n\n🏢 *Negocio:* ${business.name}\n📱 *Cliente:* +${clientPhone}\n🕐 *Hora:* ${now}\n\n👉 https://wa.me/${clientPhone}`;
    await ownerClient.sendMessage(`${ownerNumber}@c.us`, msg);
  } catch (err) { console.error("❌ Error notificando dueño:", err); }
}

/* ================================================================
   AGENDAMIENTO
================================================================ */
async function handleAgendaFlow(
  msg: any,
  business: { id: string; name: string; whatsapp_number: string },
  conv: any,
  step: any,
  text: string
): Promise<void> {
  const ctx         = conv.context_json || {};
  const agendaCtx   = ctx.agenda || {};
  const normalized  = normalizeText(text);
  const services: string[] = step.metadata?.services || [];

  if (services.length > 0) {
    if (agendaCtx.step === "waiting_service") {
      const numChoice = parseInt(normalized, 10);
      let chosenService: string | null = null;
      if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= services.length) {
        chosenService = services[numChoice - 1];
      } else {
        chosenService =
          services.find((s: string) =>
            normalizeText(s).includes(normalized) || normalized.includes(normalizeText(s))
          ) || null;
      }
      if (!chosenService) {
        const EMOJIS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
        const serviceList = services
          .map((s: string, i: number) => `${EMOJIS[i] ?? `${i + 1}.`} ${s}`)
          .join("\n");
        await sleep(600);
        await msg.reply(
          `No entendí tu elección 😅\n\nElige una opción:\n\n${serviceList}\n\nEscribe el número de tu servicio.`
        );
        return;
      }
      await pool.query(
        `UPDATE conversations
         SET mode='human', current_step=$1, requests_human=true,
             human_taken_at=NOW(), context_json=$2
         WHERE id=$3`,
        [step.id, JSON.stringify({ ...ctx, agenda: null }), conv.id]
      );
      await createNotification(
        business.id, "agenda_request", "📅 Nueva solicitud de cita",
        `+${conv.user_phone} quiere agendar: ${chosenService}`, conv.user_phone
      );
      await notifyOwner(business, conv.user_phone, "agenda", `Servicio: ${chosenService}`);
      await sleep(800);
      await msg.reply(
        `✅ Perfecto. Has elegido:\n*${chosenService}*\n\nUn asesor se pondrá en contacto contigo en breve para coordinar el horario. 🗓\n\nEscribe *menu* si necesitas algo más.`
      );
      return;
    }
    const EMOJIS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    const serviceList = services
      .map((s: string, i: number) => `${EMOJIS[i] ?? `${i + 1}.`} ${s}`)
      .join("\n");
    await pool.query(
      `UPDATE conversations SET context_json=$1 WHERE id=$2`,
      [JSON.stringify({ ...ctx, agenda: { step: "waiting_service" } }), conv.id]
    );
    await sleep(800);
    await msg.reply(`${step.message}\n\n${serviceList}\n\nEscribe el número de tu servicio.`);
    return;
  }

  const duration = step.metadata?.duration_minutes || 30;
  if (!agendaCtx.name) {
    await pool.query(
      `UPDATE conversations SET context_json=$1 WHERE id=$2`,
      [
        JSON.stringify({
          ...ctx,
          agenda: { step: "waiting_name", service: step.metadata?.service || step.id },
        }),
        conv.id,
      ]
    );
    await sleep(800);
    await msg.reply("📝 Para agendar tu cita, ¿cuál es tu nombre completo?");
    return;
  }
  if (agendaCtx.step === "waiting_name") {
    const nextSlot = await getNextAvailableSlot(business.id, duration);
    await pool.query(
      `UPDATE conversations SET context_json=$1 WHERE id=$2`,
      [
        JSON.stringify({
          ...ctx,
          agenda: { ...agendaCtx, name: text, step: "waiting_confirm", slot: nextSlot },
        }),
        conv.id,
      ]
    );
    await sleep(800);
    if (nextSlot) {
      await msg.reply(
        `Perfecto *${text}* 👋\n\nEl próximo horario disponible es:\n📅 *${formatDate(nextSlot.date)}* a las *${nextSlot.time}*\n\n¿Confirmas? Responde *sí* o escribe otro horario (ej: *mañana 3pm*)`
      );
    } else {
      await pool.query(
        `UPDATE conversations SET context_json=$1 WHERE id=$2`,
        [JSON.stringify({ ...ctx, agenda: null }), conv.id]
      );
      await msg.reply(
        "Lo siento, no hay disponibilidad esta semana. Escribe *menu* para ver otras opciones."
      );
    }
    return;
  }
  if (agendaCtx.step === "waiting_confirm") {
    if (
      ["si","sí","yes","ok","confirmo","dale","listo","perfecto"].some((w) =>
        normalized.includes(w)
      )
    ) {
      if (!agendaCtx.slot) {
        await msg.reply("Lo siento, no encontré horario. Escribe *menu* para volver.");
        return;
      }
      await pool.query(
        `INSERT INTO appointments
           (id, business_id, client_phone, client_name, service,
            appointment_date, appointment_time, duration_minutes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confirmed')`,
        [
          uuidv4(), business.id, conv.user_phone, agendaCtx.name,
          agendaCtx.service, agendaCtx.slot.date, agendaCtx.slot.time, duration,
        ]
      );
      await createNotification(
        business.id, "agenda_request", "📅 Nueva cita confirmada",
        `${agendaCtx.name} (+${conv.user_phone}) — ${formatDate(agendaCtx.slot.date)} ${agendaCtx.slot.time}`,
        conv.user_phone
      );
      await notifyOwner(
        business, conv.user_phone, "agenda",
        `${agendaCtx.name} — ${formatDate(agendaCtx.slot.date)} ${agendaCtx.slot.time}`
      );
      await pool.query(
        `UPDATE conversations SET context_json=$1, current_step='start' WHERE id=$2`,
        [JSON.stringify({ ...ctx, agenda: null }), conv.id]
      );
      await sleep(800);
      await msg.reply(
        `✅ *¡Cita confirmada!*\n\n👤 *Nombre:* ${agendaCtx.name}\n📅 *Fecha:* ${formatDate(agendaCtx.slot.date)}\n🕐 *Hora:* ${agendaCtx.slot.time}\n\nTe esperamos. Escribe *menu* si necesitas algo más.`
      );
      return;
    }
    const customSlot = parseCustomDateTime(text);
    if (customSlot) {
      const { rows: conflict } = await pool.query(
        `SELECT id FROM appointments
         WHERE business_id=$1 AND appointment_date=$2
           AND appointment_time=$3 AND status!='cancelled'`,
        [business.id, customSlot.date, customSlot.time]
      );
      if (conflict.length > 0) {
        const next = await getNextAvailableSlot(business.id, duration);
        await pool.query(
          `UPDATE conversations SET context_json=$1 WHERE id=$2`,
          [JSON.stringify({ ...ctx, agenda: { ...agendaCtx, slot: next } }), conv.id]
        );
        await msg.reply(
          `❌ Ese horario ya está ocupado.\n\nEl siguiente disponible es:\n📅 *${formatDate(next!.date)}* a las *${next!.time}*\n\n¿Confirmas? Responde *sí*.`
        );
      } else {
        await pool.query(
          `UPDATE conversations SET context_json=$1 WHERE id=$2`,
          [JSON.stringify({ ...ctx, agenda: { ...agendaCtx, slot: customSlot } }), conv.id]
        );
        await msg.reply(
          `📅 ¿Confirmas para el *${formatDate(customSlot.date)}* a las *${customSlot.time}*?\n\nResponde *sí* para confirmar.`
        );
      }
      return;
    }
    await msg.reply(
      "No entendí 😅 Responde *sí* para confirmar el horario, o escribe otro (ej: *mañana 4pm*, *viernes 10am*)"
    );
  }
}

async function getNextAvailableSlot(
  businessId: string,
  duration: number
): Promise<{ date: string; time: string } | null> {
  const startHour = 8, endHour = 20;
  const now = new Date();
  const { rows: existing } = await pool.query(
    `SELECT appointment_date, appointment_time, duration_minutes
     FROM appointments
     WHERE business_id=$1 AND appointment_date >= CURRENT_DATE AND status!='cancelled'
     ORDER BY appointment_date, appointment_time`,
    [businessId]
  );
  const occupied = new Set<string>();
  for (const appt of existing) {
    const d = appt.appointment_date.toISOString().split("T")[0];
    const [h, m] = appt.appointment_time.split(":");
    const startMin = parseInt(h) * 60 + parseInt(m);
    for (let i = 0; i < (appt.duration_minutes || 30); i += 30) {
      const total = startMin + i;
      occupied.add(
        `${d}_${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`
      );
    }
  }
  const checkDate = new Date(now);
  for (let day = 0; day < 7; day++) {
    const dateStr  = checkDate.toISOString().split("T")[0];
    const startMin =
      day === 0
        ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 30) / 30) * 30
        : startHour * 60;
    for (let min = startMin; min < endHour * 60; min += 30) {
      const hh = Math.floor(min / 60).toString().padStart(2, "0");
      const mm = (min % 60).toString().padStart(2, "0");
      let free = true;
      for (let i = 0; i < duration; i += 30) {
        const total = min + i;
        const sh = Math.floor(total / 60).toString().padStart(2, "0");
        const sm = (total % 60).toString().padStart(2, "0");
        if (occupied.has(`${dateStr}_${sh}:${sm}`)) { free = false; break; }
      }
      if (free) return { date: dateStr, time: `${hh}:${mm}` };
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }
  return null;
}

function parseCustomDateTime(text: string): { date: string; time: string } | null {
  const t   = text.toLowerCase();
  const now = new Date();
  let target = new Date(now);
  if (t.includes("mañana") || t.includes("manana")) {
    target.setDate(now.getDate() + 1);
  } else {
    const days: Record<string, number> = {
      lunes: 1, martes: 2, miercoles: 3, jueves: 4,
      viernes: 5, sabado: 6, domingo: 0,
    };
    for (const [name, day] of Object.entries(days)) {
      if (
        t.includes(name) ||
        t.includes(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
      ) {
        while (target.getDay() !== day) target.setDate(target.getDate() + 1);
        break;
      }
    }
  }
  const m = t.match(/(\d{1,2})\s*(?::|h)?(\d{0,2})\s*(am|pm)?/i);
  if (!m) return null;
  let hour       = parseInt(m[1]);
  const min      = parseInt(m[2] || "0") || 0;
  const meridian = (m[3] || "").toLowerCase();
  if (meridian === "pm" && hour < 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;
  if (hour < 8 || hour >= 20) return null;
  return {
    date: target.toISOString().split("T")[0],
    time: `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`,
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

/* ================================================================
   START CLIENT
================================================================ */
function startClient(
  business: { id: string; name: string; client_id: string; whatsapp_number: string },
  attempt = 1
): void {
  if (!business?.client_id || clients[business.id] || starting.has(business.client_id)) return;
  starting.add(business.client_id);
  botStatus[business.id] = "starting";
  launchQueue = launchQueue.then(async () => {
    if (clients[business.id]) { starting.delete(business.client_id); return; }
    console.log(`🚀 Iniciando [intento ${attempt}]: ${business.name}`);
    cleanSessionLocks(business.client_id);
    await _doStartClient(business, attempt);
    await sleep(8000);
  });
}

async function _doStartClient(
  business: { id: string; name: string; client_id: string; whatsapp_number: string },
  attempt: number
): Promise<void> {
  // Destruir instancia previa si existe para evitar el error onQRChangedEvent
  if (clients[business.id]) {
    try { await clients[business.id].destroy(); } catch {}
    delete clients[business.id];
    await sleep(3000);
  }

  // Matar procesos Chrome huérfanos de esta sesión específica
  try {
    execSync(`pkill -f "session-${business.client_id}" 2>/dev/null || true`, { stdio: "ignore" });
  } catch {}
  await sleep(2000);
  cleanSessionLocks(business.client_id);

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: business.client_id,
      dataPath: "/opt/waas/bot/sessions",
    }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--hide-scrollbars",
        "--metrics-recording-only",
        "--mute-audio",
        "--safebrowsing-disable-auto-update",
        // REMOVIDO: --single-process  ← causaba crashes silenciosos y estado zombie
      ],
    },
  });

  // Timeout de inicialización: 5 minutos — WhatsApp puede tardar con sesiones viejas
  const initTimeout = setTimeout(() => {
    console.error(`⏰ Timeout inicializando [${business.name}] intento ${attempt}`);
    try { client.destroy(); } catch {}
    delete clients[business.id];
    starting.delete(business.client_id);
    botStatus[business.id] = "error";
    // NO llamar startClient aquí — lo manejará el auto-restart con cooldown
  }, 300000);

  client.on("qr", (qr) => {
    qrCodes[business.id]  = qr;
    botStatus[business.id] = "qr";
    qrcode.generate(qr, { small: true });
    console.log(`📲 QR: ${business.name}`);
  });

  client.on("ready", async () => {
    clearTimeout(initTimeout);
    botStatus[business.id] = "online";
    delete qrCodes[business.id];
    starting.delete(business.client_id);
    console.log(`✅ ONLINE: ${business.name}`);
    try {
      const info = client.info;
      if (info?.wid?.user) {
        await pool.query(
          `UPDATE businesses SET whatsapp_number=$1
           WHERE id=$2 AND (whatsapp_number LIKE 'temp_%' OR whatsapp_number='')`,
          [info.wid.user, business.id]
        );
        business.whatsapp_number = info.wid.user;
        console.log(`📱 Número actualizado [${business.name}]: ${info.wid.user}`);
      }
    } catch {}
  });

  client.on("auth_failure", (m) => {
    clearTimeout(initTimeout);
    console.error(`🔐 Auth failure [${business.name}]:`, m);
    starting.delete(business.client_id);
    delete clients[business.id];
    // Marcar como error para que el auto-restart aplique cooldown largo
    botStatus[business.id] = "error";
  });

  client.on("disconnected", (r) => {
    clearTimeout(initTimeout);
    console.log(`❌ Desconectado [${business.name}]: ${r}`);
    delete clients[business.id];
    starting.delete(business.client_id);
    // Si fue LOGOUT (sesión revocada desde el teléfono), marcar error — necesita QR nuevo
    // Si fue otro motivo (pérdida de conexión), marcar offline — reconecta con sesión existente
    botStatus[business.id] = r === "LOGOUT" ? "error" : "offline";
  });

  /* ================================================================
     MENSAJE CREADO — captura mensajes recibidos Y enviados
  ================================================================ */
  client.on("message_create", async (msg) => {
    try {
      // ── ASESOR RESPONDIÓ MANUALMENTE ──
      if (msg.fromMe) {
        if (!msg.body) return;
        if (msg.from.includes("@g.us") || msg.from.includes("@broadcast")) return;
        // Ignorar mensajes automáticos del bot (vienen con @lid, no @c.us)
        if (!msg.from.includes("@c.us")) return;

        const toLid = msg.to.replace("@c.us", "").replace("@lid", "");
        try {
          let realNum = toLid;
          try {
            const ct = await msg.getContact();
            if (ct?.number && ct.number.length > 5) realNum = ct.number;
            else if (ct?.id?.user) realNum = ct.id.user;
          } catch {}

          const { rowCount } = await pool.query(
            `UPDATE conversations
             SET mode='human', requests_human=true, human_taken_at=NOW()
             WHERE business_id=$1 AND mode='bot'
               AND (
                 user_phone=$2
                 OR user_lid=$3
                 OR RIGHT(user_phone,10)=RIGHT($2,10)
                 OR RIGHT(user_phone,10)=RIGHT($3,10)
               )`,
            [business.id, realNum, toLid]
          );
          if (rowCount && rowCount > 0) {
            console.log(`👨‍💼 [${business.name}] Bot silenciado para ${realNum}`);
          }
        } catch (err) { console.error("Error silenciando bot:", err); }
        return;
      }

      // ── MENSAJE DEL CLIENTE ──
      if (!msg.body || msg.from.includes("@g.us") || msg.from.includes("@broadcast")) return;

      const rawFrom = msg.from;
      const userLid = rawFrom.includes("@lid") ? rawFrom.replace("@lid", "") : null;
      let phone     = rawFrom.replace("@c.us", "").replace("@lid", "");
      try {
        const contact = await msg.getContact();
        if (contact.number && contact.number.length > 5) phone = contact.number;
        else if (contact.id?.user) phone = contact.id.user;
      } catch {}

      const text       = msg.body.trim();
      const normalized = normalizeText(text);
      console.log(`📩 [${business.name}] ${phone}: ${text}`);

      // Guardar mensaje en DB
      await pool.query(
        `INSERT INTO messages (id, business_id, user_phone, from_me, message)
         VALUES ($1,$2,$3,$4,$5)`,
        [uuidv4(), business.id, phone, false, text]
      ).catch(() => {});

      // Descontar mensaje del plan
      await pool.query(
        `UPDATE businesses SET messages_used = messages_used + 1 WHERE id=$1`,
        [business.id]
      ).catch(() => {});

      // Buscar o crear conversación
      let { rows } = await pool.query(
        "SELECT * FROM conversations WHERE business_id=$1 AND user_phone=$2",
        [business.id, phone]
      );
      let conv = rows[0];

      if (!conv) {
        await createNotification(
          business.id, "new_contact", "Nuevo contacto",
          `+${phone} inició una conversación`, phone
        );
        const r = await pool.query(
          `INSERT INTO conversations (business_id, user_phone, user_lid, current_step, mode)
           VALUES ($1,$2,$3,'start','bot') RETURNING *`,
          [business.id, phone, userLid]
        );
        conv = r.rows[0];
        const newFlow   = await getBotFlow(business.id);
        const startStep = newFlow?.steps?.find((s: any) => s.id === "start");
        if (startStep) {
          await sleep(800);
          await msg.reply(startStep.message);
        }
        return;
      }

      // Actualizar user_lid si no estaba guardado
      if (userLid && !conv.user_lid) {
        await pool.query(
          "UPDATE conversations SET user_lid=$1 WHERE id=$2",
          [userLid, conv.id]
        ).catch(() => {});
      }

      // ── MODO HUMANO ── bot silenciado
      if (conv.mode === "human") {
        if (["bot","menu","inicio","start"].includes(normalized)) {
          await pool.query(
            `UPDATE conversations SET mode='bot', current_step='start', context_json='{}' WHERE id=$1`,
            [conv.id]
          );
          const flow      = await getBotFlow(business.id);
          const startStep = flow?.steps?.find((s: any) => s.id === "start");
          if (startStep) { await sleep(800); await msg.reply(startStep.message); }
        }
        return;
      }

      // ── COMANDOS GLOBALES ──
      if (["hola","menu","inicio","start","comenzar","ayuda"].includes(normalized)) {
        const flow      = await getBotFlow(business.id);
        const startStep = flow?.steps?.find((s: any) => s.id === "start");
        if (!startStep) return;
        await pool.query(
          `UPDATE conversations SET mode='bot', current_step='start', context_json='{}' WHERE id=$1`,
          [conv.id]
        );
        await sleep(600 + Math.random() * 800);
        await msg.reply(startStep.message);
        return;
      }

      const flow = await getBotFlow(business.id);
      if (!flow?.steps) return;

      const currentStep = flow.steps.find((s: any) => s.id === conv.current_step);

      // Si está en agenda activa
      if (currentStep && getStepType(currentStep) === "agenda") {
        const ctx = conv.context_json || {};
        if (ctx.agenda) {
          await handleAgendaFlow(msg, business, conv, currentStep, text);
          return;
        }
      }

      // ── PROCESAR PASO ──
      const processStep = async (step: any): Promise<void> => {
        const stepType = getStepType(step);
        console.log(`📍 [${business.name}] ${phone} → '${step.id}' (${stepType})`);

        switch (stepType) {

          case "human": {
            await pool.query(
              `UPDATE conversations
               SET mode='human', current_step=$1, requests_human=true, human_taken_at=NOW()
               WHERE id=$2`,
              [step.id, conv.id]
            );
            await createNotification(
              business.id, "human_request", "👤 Cliente solicita asesor",
              `+${phone} quiere hablar con un asesor`, phone
            );
            await notifyOwner(business, phone, "human");
            await sleep(800 + Math.random() * 1000);
            await msg.reply(step.message);
            await sleep(800);
            const { rows: bizRows } = await pool.query(
              "SELECT logo_url, name FROM businesses WHERE id=$1",
              [business.id]
            );
            const biz       = bizRows[0];
            const agentName = step.metadata?.agent_name || "un asesor";
            const waitMsg   = `🕐 *Espera un momento*\n\nEstás siendo conectado con *${agentName}*. Te responderemos lo antes posible.\n\n_Escribe *menu* para volver al menú automático._`;
            if (biz?.logo_url) {
              try {
                const media = await MessageMedia.fromUrl(biz.logo_url, { unsafeMime: true });
                await msg.reply(media, undefined, { caption: waitMsg });
              } catch {
                await msg.reply(waitMsg);
              }
            } else {
              await msg.reply(waitMsg);
            }
            break;
          }

          case "agenda": {
            await pool.query(
              `UPDATE conversations SET current_step=$1 WHERE id=$2`,
              [step.id, conv.id]
            );
            const freshConv = { ...conv, current_step: step.id };
            await handleAgendaFlow(msg, business, freshConv, step, text);
            break;
          }

          case "location": {
            await pool.query(
              `UPDATE conversations SET current_step=$1 WHERE id=$2`,
              [step.id, conv.id]
            );
            let locationMsg = step.message || "";
            if (step.metadata?.maps_url && step.metadata.maps_url.trim() !== "") {
              locationMsg += `\n\n👇 *Toca aquí para ver en Google Maps:*\n${step.metadata.maps_url}`;
            }
            await sleep(800 + Math.random() * 800);
            await msg.reply(locationMsg);
            break;
          }

          case "link": {
            await pool.query(
              `UPDATE conversations SET current_step=$1 WHERE id=$2`,
              [step.id, conv.id]
            );
            const linkMsg = step.metadata?.url
              ? `${step.message}\n\n🔗 ${step.metadata.url}`
              : step.message;
            await sleep(800 + Math.random() * 800);
            await msg.reply(linkMsg);
            break;
          }

          case "collect": {
            await pool.query(
              `UPDATE conversations SET current_step=$1 WHERE id=$2`,
              [step.id, conv.id]
            );
            await sleep(800 + Math.random() * 800);
            await msg.reply(step.message);
            break;
          }

          case "message":
          default: {
            await pool.query(
              `UPDATE conversations SET current_step=$1 WHERE id=$2`,
              [step.id, conv.id]
            );
            await sleep(800 + Math.random() * 1000);
            await msg.reply(step.message);
            break;
          }
        }
      };

      // ── NAVEGACIÓN ──
      if (!currentStep || conv.current_step === "start") {
        const startStep = flow.steps.find((s: any) => s.id === "start");
        if (!startStep) return;
        const nextId = matchOption(text, normalized, startStep.next || {});
        if (!nextId) {
          await pool.query(
            `UPDATE conversations SET current_step='start' WHERE id=$1`,
            [conv.id]
          );
          await sleep(600 + Math.random() * 800);
          await msg.reply(startStep.message);
          return;
        }
        const nextStep = flow.steps.find((s: any) => s.id === nextId);
        if (!nextStep) return;
        await processStep(nextStep);
        return;
      }

      const nextId = matchOption(text, normalized, currentStep.next || {});
      if (nextId) {
        const nextStep = flow.steps.find((s: any) => s.id === nextId);
        if (!nextStep) return;
        await processStep(nextStep);
        return;
      }

      // Paso collect — guardar dato y avanzar
      if (getStepType(currentStep) === "collect") {
        const ctx       = conv.context_json || {};
        const fieldName = currentStep.metadata?.field || currentStep.id;
        ctx[fieldName]  = text;
        await pool.query(
          `UPDATE conversations SET context_json=$1 WHERE id=$2`,
          [JSON.stringify(ctx), conv.id]
        );
        const nextKeys = Object.keys(currentStep.next || {});
        if (nextKeys.length > 0) {
          const nextStep = flow.steps.find(
            (s: any) => s.id === currentStep.next[nextKeys[0]]
          );
          if (nextStep) { await processStep(nextStep); return; }
        }
      }

      await sleep(500 + Math.random() * 800);
      await msg.reply("No entendí. Escribe *menu* para ver las opciones disponibles.");

    } catch (err) { console.error(`🔥 ERROR [${business.name}]:`, err); }
  });

  try {
    // Registrar el cliente ANTES de initialize para evitar race condition con PM2
    clients[business.id] = client;
    await client.initialize();
  } catch (err) {
    clearTimeout(initTimeout);
    console.error(`❌ initialize() falló [${business.name}] intento ${attempt}:`, err);
    starting.delete(business.client_id);
    delete clients[business.id];
    // Dejar que el auto-restart maneje el reintento con cooldown
    botStatus[business.id] = "error";
  }
}

/* ================================================================
   EXPRESS API
================================================================ */
const app = express();
app.use(express.json());

app.get("/health", (_, res) =>
  res.json({
    ok:       true,
    uptime:   Math.floor(process.uptime()),
    clients:  Object.keys(clients).length,
    statuses: botStatus,
  })
);

app.get("/statuses", (_, res) =>
  res.json(
    Object.keys(botStatus).map((id) => ({
      businessId: id,
      status:     botStatus[id],
      connected:  !!clients[id],
      hasQr:      !!qrCodes[id],
    }))
  )
);

app.get("/status/:businessId", (req, res) => {
  const { businessId } = req.params;
  const status    = botStatus[businessId] ?? "offline";
  const hasClient = !!clients[businessId];
  const qr        = qrCodes[businessId] ?? null;
  let finalStatus = "offline";
  if (hasClient && status === "online") finalStatus = "online";
  else if (qr)                          finalStatus = "qr";
  else if (status === "starting" || status === "qr") finalStatus = "connecting";
  res.json({ businessId, status: finalStatus, connected: hasClient && status === "online", hasQr: !!qr, qr });
});

app.get("/qr/:id", (req, res) => {
  const qr     = qrCodes[req.params.id];
  const status = botStatus[req.params.id] ?? "offline";
  if (!qr) return res.status(404).json({ error: "QR no disponible", status });
  res.json({ qr, status });
});

app.post("/reload/:businessId", (req, res) => {
  reloadFlow(req.params.businessId);
  res.json({ ok: true });
});

app.post("/start/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM businesses WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Empresa no encontrada" });
    startClient(rows[0]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/reset-session/:id", async (req, res) => {
  try {
    const id       = req.params.id;
    const { rows } = await pool.query("SELECT client_id FROM businesses WHERE id=$1", [id]);
    if (!rows[0]) return res.status(404).json({ error: "Empresa no encontrada" });
    const clientId = rows[0].client_id;

    if (clients[id]) { try { await clients[id].destroy(); } catch {} delete clients[id]; }
    delete qrCodes[id];
    botStatus[id] = "offline";
    starting.delete(clientId);
    reloadFlow(id);

    try { execSync(`rm -rf /opt/waas/bot/sessions/session-${clientId}`, { stdio: "ignore" }); } catch {}

    setTimeout(async () => {
      const { rows: biz } = await pool.query("SELECT * FROM businesses WHERE id=$1", [id]);
      if (biz[0]) startClient(biz[0]);
    }, 3000);

    res.json({ ok: true, message: "Sesión reseteada — nuevo QR disponible en unos segundos" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/restart/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM businesses WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Empresa no encontrada" });
    const { id, client_id } = rows[0];
    if (clients[id]) { try { await clients[id].destroy(); } catch {} delete clients[id]; }
    delete qrCodes[id];
    botStatus[id] = "offline";
    starting.delete(client_id);
    reloadFlow(id);
    cleanSessionLocks(client_id);
    setTimeout(() => startClient(rows[0]), 3000);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/send-message", async (req, res) => {
  try {
    const { businessId, phone, message, mediaUrl, caption } = req.body;
    if (!businessId || !phone) return res.status(400).json({ error: "Faltan datos" });
    const client = clients[businessId];
    if (!client || botStatus[businessId] !== "online")
      return res.status(503).json({ error: "Bot no disponible" });
    if (mediaUrl) {
      const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
      await client.sendMessage(`${phone}@c.us`, media, { caption: caption || message || "" });
    } else if (message) {
      await client.sendMessage(`${phone}@c.us`, message);
    }
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/stop/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (clients[id]) { try { await clients[id].destroy(); } catch {} delete clients[id]; }
    delete qrCodes[id];
    botStatus[id] = "offline";
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ================================================================
   AUTO-RESTART — con backoff por empresa para no spamear QR
   - Si tiene sesión guardada: reintenta cada 60s
   - Si NO tiene sesión (necesita QR): reintenta cada 10 minutos
   - Si está en estado "error" tras muchos intentos: espera 30 minutos
================================================================ */
const errorSince: Record<string, number> = {};
const lastAttempt: Record<string, number> = {};

function hasSession(clientId: string): boolean {
  const fs = require("fs");
  const sessionPath = `/opt/waas/bot/sessions/session-${clientId}`;
  try {
    return fs.existsSync(sessionPath) &&
      fs.readdirSync(sessionPath).some((f: string) => f.includes("Default"));
  } catch { return false; }
}

setInterval(async () => {
  try {
    const businesses = await getActiveBusinesses();
    const now = Date.now();

    for (const b of businesses) {
      if (clients[b.id] || starting.has(b.client_id)) continue;

      const last = lastAttempt[b.id] || 0;
      const inError = botStatus[b.id] === "error";
      const sessionExists = hasSession(b.client_id);

      // Cooldown según estado:
      // - Con sesión guardada: reintentar cada 60s
      // - Sin sesión (necesita QR nuevo): cada 10 minutos para no bloquear
      // - En estado error prolongado: cada 30 minutos
      let cooldown = sessionExists ? 60_000 : 600_000;
      if (inError) {
        if (!errorSince[b.id]) errorSince[b.id] = now;
        const errorDuration = now - errorSince[b.id];
        if (errorDuration > 10 * 60_000) cooldown = 30 * 60_000; // 30 min tras 10 min fallando
      } else {
        delete errorSince[b.id];
      }

      if (now - last < cooldown) continue;

      lastAttempt[b.id] = now;
      console.log(`🔄 AUTO-START [${b.name}] (sesión: ${sessionExists ? "✓" : "✗"}, cooldown: ${cooldown/1000}s)`);
      startClient(b);
    }
  } catch (err) { console.error("AUTO-START ERROR:", err); }
}, 30_000); // revisar cada 30s, pero con cooldown por empresa

/* ================================================================
   SHUTDOWN GRACEFUL
================================================================ */
async function shutdown(signal: string) {
  console.log(`\n🛑 ${signal} — cerrando clientes…`);
  await Promise.allSettled(
    Object.entries(clients).map(async ([, c]) => { try { await c.destroy(); } catch {} })
  );
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

/* ================================================================
   ARRANQUE
================================================================ */
app.listen(3333, "0.0.0.0", async () => {
  console.log("🤖 BOT SERVICE RUNNING :3333");
  try {
    const businesses = await getActiveBusinesses();
    console.log(`📋 Arrancando ${businesses.length} negocio(s)`);
    for (const b of businesses) startClient(b);
  } catch (err) { console.error("Error en arranque inicial:", err); }
});

