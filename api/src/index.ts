import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();

import authRoutes         from "./routes/auth";
import extensionRoutes    from "./routes/extension";
import aiRoutes           from "./routes/ai";
import dashboardRoutes    from "./routes/dashboard";
import planRoutes         from "./routes/plan";
import botRoutes          from "./routes/bot";
import contentRoutes      from "./routes/content";
import conversationRoutes from "./routes/conversations";
import paymentRoutes      from "./routes/payments";
import notificationRoutes from "./routes/notifications";
import appointmentRoutes  from "./routes/appointments";
import businessRoutes     from "./routes/business";
import campaignRoutes     from "./routes/campaigns";
import { authenticate }   from "./middleware/authMiddleware";
import { startSubscriptionCheck } from "./jobs/subscriptionCheck";

app.use(cors({
  origin: [
    "https://panel.shoppyworld.site",
    "https://api.shoppyworld.site",
    "http://localhost:5173",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());

app.get("/",       (_req, res) => res.json({ status: "WAAS API RUNNING", time: new Date() }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/auth",      authRoutes);
app.use("/payments",  paymentRoutes);
app.use("/extension", extensionRoutes);
app.use("/ai",        aiRoutes);

app.use("/dashboard",     authenticate, dashboardRoutes);
app.use("/plan",          authenticate, planRoutes);
app.use("/bot",           authenticate, botRoutes);
app.use("/content",       authenticate, contentRoutes);
app.use("/conversations",  authenticate, conversationRoutes);
app.use("/notifications",  authenticate, notificationRoutes);
app.use("/appointments",   authenticate, appointmentRoutes);
app.use("/business",       authenticate, businessRoutes);
app.use("/campaigns",      authenticate, campaignRoutes);
app.use("/logos", require("express").static(require("path").join(__dirname, "../public/logos")));
app.use("/menus", require("express").static(require("path").join(__dirname, "../public/menus")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API running on port ${PORT}`);
  startSubscriptionCheck();
});

