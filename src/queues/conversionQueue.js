/**
 * Conversion Processing Queue
 * ────────────────────────────
 * BullMQ queue that decouples webhook ingestion from database writes.
 * The Express server enqueues jobs here; the worker consumes them.
 */
import { Queue } from "bullmq";
import { createRedisConnection } from "../config/redis.js";

export const QUEUE_NAME = "conversion-processing";

export const conversionQueue = new Queue(QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    // ── Retry Strategy ─────────────────────────────────────────────────
    // Exponential backoff: 2s → 4s → 8s → 16s → 32s (5 attempts total).
    // Handles transient Supabase / network timeouts gracefully.
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000, // base delay in ms
    },
    // Keep completed/failed jobs for observability (BullBoard, etc.).
    removeOnComplete: { age: 86400, count: 1000 }, // 24h or 1k jobs
    removeOnFail:     { age: 604800, count: 5000 }, // 7d or 5k jobs
  },
});
