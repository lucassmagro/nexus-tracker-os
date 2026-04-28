/**
 * Webhook Routes
 * ──────────────
 * Mounts webhook endpoints for third-party integrations.
 *
 * Shopify webhooks include the workspace_id in the URL path so we can
 * associate the order with the correct tenant. Each workspace gets a
 * unique webhook URL: /webhooks/shopify/:workspaceId/order
 */
import { Router } from "express";
import { verifyShopifyHmac } from "../middleware/shopifyHmac.js";
import { handleShopifyOrder } from "../controllers/shopifyController.js";

const router = Router();

/**
 * POST /webhooks/shopify/:workspaceId/order
 * Receives Shopify `orders/create` webhook events for a specific workspace.
 *
 * Flow: HMAC verify (raw body) → controller → BullMQ enqueue
 */
router.post("/webhooks/shopify/:workspaceId/order", verifyShopifyHmac, handleShopifyOrder);

export default router;
