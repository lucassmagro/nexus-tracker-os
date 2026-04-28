/**
 * Shopify Webhook Controller
 * ──────────────────────────
 * Handles Shopify `orders/create` webhooks. Reads workspace_id from the
 * URL parameter, verifies it exists, and pushes the payload into BullMQ.
 */
import { conversionQueue } from "../queues/conversionQueue.js";
import { isValidWorkspace } from "../middleware/verifyWorkspace.js";

/**
 * POST /webhooks/shopify/:workspaceId/order
 * Enqueues a Shopify order payload for asynchronous processing.
 */
export async function handleShopifyOrder(req, res) {
  try {
    const workspaceId = req.params.workspaceId;
    const order = req.body;

    // Verify workspace exists
    if (!workspaceId || !(await isValidWorkspace(workspaceId))) {
      return res.status(404).json({ ok: false, error: "Workspace not found." });
    }

    if (!order.id || !order.order_number) {
      return res.status(400).json({ ok: false, error: "Missing order id/order_number." });
    }

    await conversionQueue.add(
      "shopify-order",
      {
        workspace_id: workspaceId,
        order_id:     String(order.id),
        order_number: String(order.order_number),
        total_price:  order.total_price,
        currency:     order.currency,
        customer: {
          email:      order.customer?.email  || null,
          first_name: order.customer?.first_name || null,
          last_name:  order.customer?.last_name  || null,
        },
        note_attributes: order.note_attributes || [],
        landing_site:    order.landing_site    || null,
        referring_site:  order.referring_site  || null,
        source_name:     order.source_name     || null,
        created_at:      order.created_at,
      },
      { jobId: `shopify-order-${order.id}` }
    );

    console.log(`[nexus] Enqueued Shopify order #${order.order_number} for workspace ${workspaceId}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[nexus] Failed to enqueue Shopify order:", err);
    return res.status(500).json({ ok: false, error: "Failed to enqueue order." });
  }
}
