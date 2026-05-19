import { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { AuthRequest } from "./authMiddleware";

/**
 * Middleware que bloquea acceso si la suscripción no está activa
 */
export const checkSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(401).json({ error: "Usuario sin empresa asignada" });
    }

    const result = await pool.query(
      "SELECT subscription_status, subscription_end FROM businesses WHERE id=$1",
      [businessId]
    );

    const business = result.rows[0];

    if (!business) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }

    const now = new Date();
    const subEnd = business.subscription_end ? new Date(business.subscription_end) : null;

    // 🔴 Verifica status y fecha de vencimiento
    if (
      business.subscription_status !== "active" ||
      (subEnd && subEnd < now)
    ) {
      return res.status(403).json({
        error: "Acceso bloqueado: suscripción inactiva o vencida",
      });
    }

    // ✅ Todo bien, seguir al siguiente middleware o ruta
    next();
  } catch (err: any) {
    console.error("Error middleware suscripción:", err.message);
    return res.status(500).json({ error: "Error validando suscripción" });
  }
};
