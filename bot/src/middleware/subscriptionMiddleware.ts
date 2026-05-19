import { Request, Response, NextFunction } from "express";
import { pool } from "../db";

export const checkSubscription = async (req: Request, res: Response, next: NextFunction | (() => void)) => {
  try {
    const businessId = (req as any).user?.businessId;
    if (!businessId) return res.status(401).json({ error: "No autorizado" });

    const { rows } = await pool.query(
      "SELECT subscription_status, subscription_end FROM businesses WHERE id=$1",
      [businessId]
    );

    const business = rows[0];
    if (!business) return res.status(404).json({ error: "Negocio no encontrado" });

    if (business.subscription_status !== "active") {
      return res.status(403).json({ error: "Suscripción no activa" });
    }

    const now = new Date();
    if (business.subscription_end && new Date(business.subscription_end) < now) {
      return res.status(403).json({ error: "Suscripción vencida" });
    }

    // Si next es función de Express
    if (typeof next === "function") {
      next();
    }
  } catch (err: any) {
    console.error("checkSubscription error:", err.message);
    return res.status(500).json({ error: "Error verificando suscripción" });
  }
};
