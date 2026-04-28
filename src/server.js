/**
 * Nexus Tracker OS — Ingestion Server
 * ────────────────────────────────────
 * Lightweight Express server that receives events from the tracking pixel
 * and webhook integrations, persisting them into Supabase (PostgreSQL)
 * via the service_role client and BullMQ job queues.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import trackRouter from "./routes/track.js";
import webhookRouter from "./routes/webhooks.js";

const app  = express();
const PORT = process.env.PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────────────────
// The tracking pixel fires from arbitrary client domains, so we need
// permissive CORS. In production, lock this down to known origins.
const corsOrigins = process.env.CORS_ORIGINS || "*";

app.use(
  cors({
    origin: corsOrigins === "*" ? true : corsOrigins.split(",").map((o) => o.trim()),
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400, // preflight cache: 24 h
  })
);

// ── Webhook Routes (BEFORE body parsing) ──────────────────────────────────
// Shopify HMAC verification needs the raw request body, so webhook routes
// must be mounted BEFORE express.json() consumes the stream.
app.use(webhookRouter);

// ── Body Parsing ──────────────────────────────────────────────────────────
// Limit payload size — tracking events should be tiny.
app.use(express.json({ limit: "16kb" }));

// ── Static Files ──────────────────────────────────────────────────────────
// Serve tracker.js from /public so it can be loaded as a script tag.
app.use(express.static("public"));

// ── Routes ────────────────────────────────────────────────────────────────
app.use(trackRouter);

// ── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nexus-tracker-os", uptime: process.uptime() });
});

// ── 404 Fallback ──────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found." });
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[nexus] ✓ Ingestion server running on http://localhost:${PORT}`);
  console.log(`[nexus]   POST /track                   — receive pixel events`);
  console.log(`[nexus]   POST /webhooks/shopify/order   — Shopify order webhooks`);
  console.log(`[nexus]   GET  /health                   — health check`);
  console.log(`[nexus]   GET  /tracker.js               — serve the pixel script`);
  console.log(`[nexus]`);
  console.log(`[nexus] ⚡ Start the worker separately:  npm run worker`);
});
