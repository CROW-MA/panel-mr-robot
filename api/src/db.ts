import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new Pool({
  host:              "localhost",
  port:              5433,
  user:              "waas",
  password:          "waas123",
  database:          "waas",
  max:               10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err.message);
});

// Reconexión automática — verifica cada 30s y reconecta si el pool está roto
setInterval(async () => {
  try {
    const client = await pool.connect();
    client.release();
  } catch (err: any) {
    console.error("🔄 Pool reconectando...", err.message);
  }
}, 30000);
