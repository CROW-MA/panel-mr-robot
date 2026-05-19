import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/authMiddleware";

const router = Router();

/**
 * GET BUSINESS CONTENT
 */
router.get("/", authenticate, async (req: AuthRequest, res) => {
  const businessId = req.user!.businessId;

  // Verificar que el negocio esté activo
  const business = await pool.query(
    "SELECT is_active FROM businesses WHERE id=$1",
    [businessId]
  );

  if (!business.rows[0]) {
    return res.status(404).json({ error: "Business not found" });
  }

  if (!business.rows[0].is_active) {
    return res.status(403).json({ error: "Business is disabled" });
  }

  const content = await pool.query(
    "SELECT * FROM business_content WHERE business_id=$1",
    [businessId]
  );

  res.json(content.rows[0] || {});
});

/**
 * UPDATE BUSINESS CONTENT
 */
router.put("/", authenticate, async (req: AuthRequest, res) => {
  const businessId = req.user!.businessId;

  const {
    welcome_message,
    services_message,
    address_message,
    hours_message,
    store_message,
  } = req.body;

  // Verificar negocio + límites
  const business = await pool.query(
    "SELECT is_active, message_limit, messages_used FROM businesses WHERE id=$1",
    [businessId]
  );

  if (!business.rows[0]) {
    return res.status(404).json({ error: "Business not found" });
  }

  if (!business.rows[0].is_active) {
    return res.status(403).json({ error: "Business is disabled" });
  }

  if (business.rows[0].messages_used >= business.rows[0].message_limit) {
    return res.status(403).json({ error: "Plan message limit reached" });
  }

  await pool.query(
    `UPDATE business_content SET
     welcome_message=$1,
     services_message=$2,
     address_message=$3,
     hours_message=$4,
     store_message=$5,
     updated_at=now()
     WHERE business_id=$6`,
    [
      welcome_message,
      services_message,
      address_message,
      hours_message,
      store_message,
      businessId,
    ]
  );

  res.json({ message: "Updated successfully" });
});

export default router;
