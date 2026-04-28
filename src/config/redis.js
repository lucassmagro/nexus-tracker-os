/**
 * Redis Connection
 * ────────────────
 * Shared IORedis connection config used by BullMQ queues and workers.
 * Centralised here so every module uses the same connection parameters.
 */
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Creates a new IORedis instance.
 * BullMQ requires separate connections for Queue and Worker,
 * so we export a factory instead of a singleton.
 */
export function createRedisConnection() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });
}
