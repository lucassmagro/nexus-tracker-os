/**
 * Workspace Verification Middleware
 * ──────────────────────────────────
 * Verifies that a workspace_id exists in the database before allowing
 * ingestion. Caches valid workspace IDs in memory (TTL: 5 min) to avoid
 * hitting Supabase on every single tracking request.
 */
import { supabase } from "../config/supabase.js";

/** In-memory cache: workspace_id → expiry timestamp */
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if a workspace_id is valid (exists in the workspaces table).
 * @param {string} workspaceId
 * @returns {Promise<boolean>}
 */
async function isValidWorkspace(workspaceId) {
  // Check cache first
  const cached = cache.get(workspaceId);
  if (cached && cached > Date.now()) return true;

  // Query Supabase
  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .limit(1)
    .single();

  if (error || !data) return false;

  // Cache the valid workspace
  cache.set(workspaceId, Date.now() + CACHE_TTL_MS);
  return true;
}

/**
 * UUID v4 format check (fast, avoids DB query on garbage input).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Express middleware — validates workspace_id from the request body.
 * Rejects with 400 if missing/malformed, 404 if not found in DB.
 */
export async function verifyWorkspace(req, res, next) {
  const workspaceId = req.body.workspace_id;

  if (!workspaceId || typeof workspaceId !== "string") {
    return res.status(400).json({ ok: false, error: "'workspace_id' is required." });
  }

  if (!UUID_RE.test(workspaceId)) {
    return res.status(400).json({ ok: false, error: "'workspace_id' must be a valid UUID." });
  }

  const valid = await isValidWorkspace(workspaceId);
  if (!valid) {
    return res.status(404).json({ ok: false, error: "Workspace not found." });
  }

  next();
}

/**
 * Standalone helper for non-middleware use (e.g. in workers).
 */
export { isValidWorkspace };
