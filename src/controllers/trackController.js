/**
 * Track Controller
 * ────────────────
 * Handles the business logic for ingesting page-view events.
 * Receives a validated payload (workspace_id already verified),
 * maps it to the `page_views` schema, and inserts via Supabase.
 */
import { supabase } from "../config/supabase.js";

/**
 * POST /track
 * Inserts a single page-view event into the `page_views` table.
 *
 * Expected body (validated + workspace verified by middleware):
 *   { workspace_id, url, fingerprint, session_id, utm, referrer?, user_agent? }
 */
export async function handleTrack(req, res) {
  try {
    const {
      workspace_id,
      url,
      fingerprint,
      session_id,
      utm = {},
      referrer,
      user_agent,
    } = req.body;

    const row = {
      workspace_id,
      anonymous_fingerprint_id: `${fingerprint}:${session_id}`,
      url,
      referrer:     referrer || null,
      utm_source:   utm.utm_source   || null,
      utm_campaign: utm.utm_campaign  || null,
      utm_medium:   utm.utm_medium    || null,
      utm_term:     utm.utm_term      || null,
      utm_content:  utm.utm_content   || null,
      user_agent:   user_agent || null,
    };

    const { error } = await supabase.from("page_views").insert(row);

    if (error) {
      console.error("[nexus] Supabase insert error:", error.message);
      return res.status(502).json({ ok: false, error: "Ingestion failed." });
    }

    return res.status(204).end();
  } catch (err) {
    console.error("[nexus] Unexpected error in /track:", err);
    return res.status(500).json({ ok: false, error: "Internal server error." });
  }
}
