/**
 * Nexus Tracker OS — Cron Scheduler
 * ──────────────────────────────────
 * Runs scheduled background jobs using node-cron.
 * This process is independent of the Express server and the BullMQ worker.
 *
 * Usage:
 *   npm run cron                 (with --watch for dev)
 *   npm run cron:start           (production)
 *   npm run cron -- --run-now    (immediate execution for testing)
 *
 * Schedule (UTC):
 *   • Ad Spend Sync: Daily at 03:00 UTC
 *     - Why 3 AM? Ad platforms finalize the previous day's metrics by
 *       midnight–2 AM. Running at 3 AM gives a buffer for late data.
 */
import "dotenv/config";
import cron from "node-cron";
import { runAdSpendSync } from "./jobs/adSpendSync.js";

// ── Configuration ─────────────────────────────────────────────────────────
const AD_SPEND_SCHEDULE = process.env.AD_SPEND_CRON || "0 3 * * *"; // 03:00 UTC daily

// ── Validate cron expression ──────────────────────────────────────────────
if (!cron.validate(AD_SPEND_SCHEDULE)) {
  console.error(`[cron] FATAL — Invalid cron expression: "${AD_SPEND_SCHEDULE}"`);
  process.exit(1);
}

// ── Schedule: Ad Spend Sync ───────────────────────────────────────────────
cron.schedule(AD_SPEND_SCHEDULE, async () => {
  console.log(`[cron] Triggering ad-spend sync (schedule: ${AD_SPEND_SCHEDULE})`);
  try {
    await runAdSpendSync();
  } catch (err) {
    // This should never happen — runAdSpendSync handles its own errors.
    // But just in case, we catch here to prevent the cron scheduler from dying.
    console.error("[cron] Unexpected error in ad-spend sync:", err);
  }
}, {
  timezone: "UTC",
  scheduled: true,
});

console.log(`[cron] ✓ Cron scheduler started.`);
console.log(`[cron]   Ad Spend Sync: "${AD_SPEND_SCHEDULE}" (UTC)`);

// ── Immediate run (for testing) ───────────────────────────────────────────
// Pass --run-now to execute the job immediately on startup.
if (process.argv.includes("--run-now")) {
  console.log("[cron] --run-now flag detected, executing ad-spend sync immediately...\n");
  runAdSpendSync().catch((err) => {
    console.error("[cron] Immediate run failed:", err);
  });
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────
function shutdown() {
  console.log("[cron] Shutting down scheduler...");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
