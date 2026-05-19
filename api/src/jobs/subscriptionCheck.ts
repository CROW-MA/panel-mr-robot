import cron from "node-cron";
import { pool } from "../db";

async function checkSubscriptions(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout = '30s'");
    console.log("🔔 Revisando suscripciones y trials...");
    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    await client.query("BEGIN");

    const { rows: expiredActive } = await client.query(
      `UPDATE businesses
       SET subscription_status='expired', is_active=false
       WHERE subscription_status='active'
         AND subscription_end IS NOT NULL
         AND subscription_end < $1
       RETURNING id, name`,
      [now]
    );

    const { rows: expiredTrials } = await client.query(
      `UPDATE businesses
       SET subscription_status='expired', is_active=false
       WHERE subscription_status='trial'
         AND trial_ends_at IS NOT NULL
         AND trial_ends_at < $1
       RETURNING id, name`,
      [now]
    );

    const { rows: expiringSoon } = await client.query(
      `SELECT b.id, b.name, b.subscription_status,
              b.subscription_end, b.trial_ends_at, u.email
       FROM businesses b
       JOIN users u ON u.business_id = b.id
       WHERE b.is_active = true
         AND (
           (b.subscription_status='active' AND b.subscription_end BETWEEN $1 AND $2)
           OR
           (b.subscription_status='trial'  AND b.trial_ends_at   BETWEEN $1 AND $2)
         )`,
      [now, in3days]
    );

    await client.query("COMMIT");

    for (const b of expiredActive) {
      console.log(`🛑 Plan activo vencido: ${b.name} (${b.id})`);
    }
    for (const b of expiredTrials) {
      console.log(`🛑 Trial vencido: ${b.name} (${b.id})`);
    }
    for (const b of expiringSoon) {
      const endDate  = b.subscription_end || b.trial_ends_at;
      const daysLeft = Math.ceil(
        (new Date(endDate).getTime() - now.getTime()) / 86400000
      );
      console.log(`⚠️  Vence en ${daysLeft} día(s): ${b.name} (${b.email})`);
      // Aquí puedes agregar envío de email de aviso
    }

    const total = expiredActive.length + expiredTrials.length;
    console.log(
      `✅ Revisión completada — ${total} vencida(s), ${expiringSoon.length} próxima(s) a vencer`
    );
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("❌ Error revisando suscripciones:", err);
  } finally {
    client.release();
  }
}

export const startSubscriptionCheck = (): void => {
  // Ejecutar inmediatamente al arrancar para no esperar la primera hora
  checkSubscriptions().catch(console.error);

  // Guard anti-overlap: si la ejecución anterior sigue corriendo, la siguiente espera
  let running = false;

  cron.schedule("0 * * * *", async () => {
    if (running) {
      console.warn("⚠️  subscriptionCheck: ejecución anterior aún activa, saltando");
      return;
    }
    running = true;
    try {
      await checkSubscriptions();
    } finally {
      running = false;
    }
  });

  console.log("⏰ Job de suscripciones iniciado — revisa cada hora");
};

