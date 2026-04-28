/**
 * Validation Middleware
 * ─────────────────────
 * Lightweight request-body validation for the /track endpoint.
 * Rejects malformed payloads early, before they reach the controller.
 */

/** Maximum allowed string length for free-text fields. */
const MAX_LEN = 2048;

/**
 * Asserts that `value` is a non-empty string within `maxLen`.
 * @param {*} value
 * @param {number} [maxLen=MAX_LEN]
 * @returns {boolean}
 */
function isStr(value, maxLen = MAX_LEN) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLen;
}

/**
 * Validates the UTM object. All UTM fields are optional, but if present
 * they must be short strings (≤ 500 chars).
 * @param {*} utm
 * @returns {boolean}
 */
function isValidUtm(utm) {
  if (utm === undefined || utm === null) return true; // UTMs are optional
  if (typeof utm !== "object" || Array.isArray(utm)) return false;

  const allowed = ["utm_source", "utm_campaign", "utm_medium", "utm_term", "utm_content"];
  for (const key of Object.keys(utm)) {
    if (!allowed.includes(key)) return false;
    if (!isStr(utm[key], 500)) return false;
  }
  return true;
}

/**
 * Express middleware — validates the tracking payload.
 * Returns 400 with a JSON error if validation fails.
 */
export function validateTrackPayload(req, res, next) {
  const { url, fingerprint, session_id, utm, workspace_id } = req.body;

  const errors = [];

  if (!isStr(workspace_id, 36)) errors.push("'workspace_id' must be a valid UUID string.");
  if (!isStr(url))              errors.push("'url' must be a non-empty string (max 2048 chars).");
  if (!isStr(fingerprint))      errors.push("'fingerprint' must be a non-empty string.");
  if (!isStr(session_id))       errors.push("'session_id' must be a non-empty string.");
  if (!isValidUtm(utm))         errors.push("'utm' must be an object with valid UTM keys/values.");

  if (errors.length) {
    return res.status(400).json({ ok: false, errors });
  }

  next();
}
