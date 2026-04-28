/**
 * Conversion Processing Worker
 * ─────────────────────────────
 * BullMQ worker that consumes the `conversion-processing` queue and
 * upserts conversion records into Supabase.
 *
 * Run standalone:  node --watch src/workers/conversionWorker.js
 *
 * Retry behaviour (configured at queue level):
 *   • 5 attempts with exponential backoff (2s → 4s → 8s → 16s → 32s).
 *   • Handles transient Supabase / network timeouts gracefully.
 *   • Failed jobs are kept for 7 days for debugging.
 */
import "dotenv/config";
import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis.js";
import { supabase } from "../config/supabase.js";
import { QUEUE_NAME } from "../queues/conversionQueue.js";

/**
 * Attempts to extract the anonymous fingerprint ID from Shopify's
 * note_attributes. The storefront integration should set a note attribute
 * named `_nxs_fingerprint` carrying the `fingerprint:session_id` value
 * from the tracking cookie.
 *
 * @param {Array<{name: string, value: string}>} noteAttributes
 * @returns {string|null}
 */
function extractFingerprint(noteAttributes) {
  if (!Array.isArray(noteAttributes)) return null;
  const attr = noteAttributes.find(
    (a) => a.name === "_nxs_fingerprint" || a.name === "_nxs_tracker"
  );
  return attr?.value || null;
}

/**
 * Processes a single Shopify order job.
 *
 * @param {import("bullmq").Job} job
 */
async function processConversion(job) {
  const {
    workspace_id,
    order_id,
    order_number,
    total_price,
    currency,
    note_attributes,
    landing_site,
    referring_site,
    created_at,
  } = job.data;

  console.log(
    `[worker] Processing order #${order_number} (id: ${order_id}) for workspace ${workspace_id}, attempt ${job.attemptsMade + 1}/${job.opts.attempts}`
  );

  // Resolve the fingerprint from storefront integration or fall back to
  // a placeholder. Conversions without a fingerprint can still be matched
  // later via email or manual reconciliation.
  const fingerprint = extractFingerprint(note_attributes) || `unmatched:${order_id}`;

  // Build the conversion row.
  // Uses UPSERT (onConflict) keyed on (workspace_id, order_id) so that
  // duplicate Shopify webhooks are idempotent at the DB level too.
  const row = {
    workspace_id,
    order_id,
    value:                    parseFloat(total_price) || 0,
    currency:                 (currency || "BRL").toUpperCase(),
    status:                   "paid",
    anonymous_fingerprint_id: fingerprint,
    metadata: {
      order_number,
      landing_site:  landing_site  || null,
      referring_site: referring_site || null,
      source:        "shopify",
    },
  };

  const { error } = await supabase
    .from("conversions")
    .upsert(row, { onConflict: "workspace_id,order_id" });

  if (error) {
    console.error(`[worker] Supabase upsert failed for order #${order_number}:`, error.message);
    // Throwing makes BullMQ retry with exponential backoff.
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  console.log(`[worker] ✓ Order #${order_number} saved to conversions table.`);
}

// ── Instantiate Worker ────────────────────────────────────────────────────
const worker = new Worker(QUEUE_NAME, processConversion, {
  connection: createRedisConnection(),
  concurrency: 5, // process up to 5 jobs in parallel
  limiter: {
    max: 50,       // max 50 jobs
    duration: 1000, // per second — stay within Supabase rate limits
  },
});

// ── Worker Lifecycle Events ───────────────────────────────────────────────
worker.on("ready", () => {
  console.log(`[worker] ✓ Conversion worker ready, listening on queue "${QUEUE_NAME}"`);
});

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed.`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`,
    err.message
  );
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────
async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[worker] Conversion worker starting...");
