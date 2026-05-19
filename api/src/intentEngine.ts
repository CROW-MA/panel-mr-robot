import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  port: 5433,
  user: "waas",
  password: "waas123",
  database: "waas",
});

export async function detectIntent(businessId: string, message: string) {
  const text = message.toLowerCase();

  const { rows: intents } = await pool.query(
    "SELECT * FROM intents WHERE business_id = $1 AND is_active = true ORDER BY priority DESC",
    [businessId]
  );

  for (const intent of intents) {
    const { rows: keywords } = await pool.query(
      "SELECT keyword FROM intent_keywords WHERE intent_id = $1",
      [intent.id]
    );

    for (const k of keywords) {
      if (text.includes(k.keyword)) {
        return intent.response;
      }
    }
  }

  return "🤖 No entendí tu mensaje. ¿Puedes reformularlo?";
}
