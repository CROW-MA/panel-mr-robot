import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

const clients: Record<string, Client> = {};

export function createClient(business: any, onQR?: (qr: string) => void) {

  if (clients[business.id]) {
    return clients[business.id];
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: business.client_id,
      dataPath: "/opt/waas/bot/sessions",
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    console.log(`QR ${business.name}`);

    if (onQR) onQR(qr);

    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log(`✅ ${business.name} conectado`);
  });

  client.initialize();

  clients[business.id] = client;

  return client;
}

export function getClient(businessId: string) {
  return clients[businessId];
}

export async function destroyClient(businessId: string) {
  const client = clients[businessId];

  if (client) {
    await client.destroy();
    delete clients[businessId];
  }
}
