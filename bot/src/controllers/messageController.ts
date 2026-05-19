import { Request, Response } from "express";
import { checkSubscription } from "../middleware/subscriptionMiddleware";

export const sendMessage = async (req: Request, res: Response) => {
  // ✅ Llamamos al check de suscripción
  await checkSubscription(req, res, async () => {
    // Aquí va la lógica real de enviar el mensaje
    const { text, recipient } = req.body;
    console.log(`Enviando mensaje a ${recipient}: ${text}`);

    // Simulación de respuesta
    res.json({ ok: true, message: `Mensaje enviado a ${recipient}` });
  });
};
