/**
 * Shopify HMAC Verification Middleware
 * ─────────────────────────────────────
 * Shopify signs every webhook payload with the store's shared secret using
 * HMAC-SHA256. This middleware:
 *   1. Captures the raw body BEFORE Express parses it as JSON.
 *   2. Computes the expected HMAC from the raw bytes + shared secret.
 *   3. Compares it against the `X-Shopify-Hmac-Sha256` header.
 *   4. Rejects the request with 401 if the signature is invalid.
 *
 * IMPORTANT: This middleware must be mounted BEFORE express.json() on the
 * webhook route, because express.json() consumes the raw body stream.
 * We handle raw body capture + JSON parsing internally.
 */
import crypto from "node:crypto";

const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

/**
 * Express middleware that verifies the Shopify HMAC signature.
 * Attaches the parsed JSON body to `req.body` on success.
 */
export function verifyShopifyHmac(req, res, next) {
  if (!SHOPIFY_SECRET) {
    console.error("[nexus] FATAL — SHOPIFY_WEBHOOK_SECRET is not set.");
    return res.status(500).json({ ok: false, error: "Webhook secret not configured." });
  }

  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  if (!hmacHeader) {
    return res.status(401).json({ ok: false, error: "Missing HMAC signature header." });
  }

  // Collect the raw body chunks.
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));

  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);

    // Compute expected HMAC.
    const computed = crypto
      .createHmac("sha256", SHOPIFY_SECRET)
      .update(rawBody)
      .digest("base64");

    // Timing-safe comparison to prevent timing attacks.
    const expected = Buffer.from(computed, "utf8");
    const received = Buffer.from(hmacHeader, "utf8");

    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      console.warn("[nexus] Shopify HMAC mismatch — rejecting webhook.");
      return res.status(401).json({ ok: false, error: "Invalid HMAC signature." });
    }

    // HMAC valid — parse JSON body and continue.
    try {
      req.body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid JSON payload." });
    }

    next();
  });

  req.on("error", (err) => {
    console.error("[nexus] Error reading webhook body:", err);
    return res.status(500).json({ ok: false, error: "Failed to read request body." });
  });
}
