/**
 * Google Ads API — Mock Integration
 * ──────────────────────────────────
 * Simulates fetching daily ad spend from the Google Ads API (v17+).
 *
 * REAL IMPLEMENTATION NOTES:
 * ─────────────────────────
 * SDK:        google-ads-api (npm)
 * Auth:       OAuth 2.0 refresh token + developer token stored per workspace
 * Endpoint:   GoogleAdsService.SearchStream (GAQL query)
 * Query:
 *   SELECT
 *     campaign.name,
 *     metrics.cost_micros,
 *     metrics.impressions,
 *     metrics.clicks
 *   FROM campaign
 *   WHERE segments.date = 'YYYY-MM-DD'
 *   ORDER BY campaign.name
 *
 * Notes:
 *   - cost_micros is in millionths of the account currency (divide by 1e6)
 *   - Rate limit: 15,000 requests / day / developer token
 *   - Use SearchStream (not Search) for large result sets
 *
 * The mock returns realistic-looking data so the rest of the pipeline
 * can be tested end-to-end without real Google Ads credentials.
 */

/** @typedef {{ campaign_name: string, spend: number, impressions: number, clicks: number, currency: string }} GoogleSpendRow */

/**
 * Mock: Fetch yesterday's ad spend from Google Ads for a given workspace.
 *
 * @param {object}  workspace                     - Workspace config
 * @param {string}  workspace.id                  - Workspace UUID
 * @param {string}  workspace.google_refresh_token - Google OAuth refresh token
 * @param {string}  workspace.google_customer_id   - Google Ads customer ID (xxx-xxx-xxxx)
 * @param {string}  dateStr                        - The date to fetch spend for (YYYY-MM-DD)
 * @returns {Promise<GoogleSpendRow[]>}
 * @throws {Error} Simulates token expiration / revocation
 */
export async function fetchGoogleAdSpend(workspace, dateStr) {
  // ── Simulate token expiration ──────────────────────────────────────────
  if (workspace.google_refresh_token === "EXPIRED") {
    throw new Error(
      `Google Ads refresh token revoked for workspace "${workspace.id}". ` +
      `Re-authenticate via OAuth consent screen.`
    );
  }

  // ── Simulate API latency ───────────────────────────────────────────────
  await sleep(randomBetween(150, 500));

  // ── Mock response ──────────────────────────────────────────────────────
  // In production, this would be:
  //
  //   import { GoogleAdsApi } from "google-ads-api";
  //
  //   const client = new GoogleAdsApi({
  //     client_id:       process.env.GOOGLE_CLIENT_ID,
  //     client_secret:   process.env.GOOGLE_CLIENT_SECRET,
  //     developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
  //   });
  //
  //   const customer = client.Customer({
  //     customer_id:   workspace.google_customer_id,
  //     refresh_token: workspace.google_refresh_token,
  //   });
  //
  //   const rows = await customer.query(`
  //     SELECT
  //       campaign.name,
  //       metrics.cost_micros,
  //       metrics.impressions,
  //       metrics.clicks
  //     FROM campaign
  //     WHERE segments.date = '${dateStr}'
  //     ORDER BY campaign.name
  //   `);
  //
  //   return rows.map(row => ({
  //     campaign_name: row.campaign.name,
  //     spend:         row.metrics.cost_micros / 1e6,
  //     impressions:   row.metrics.impressions,
  //     clicks:        row.metrics.clicks,
  //     currency:      "USD",
  //   }));

  return [
    {
      campaign_name: "google_search_brand_terms",
      spend:         randomBetween(40, 180) + Math.random(),
      impressions:   randomBetween(3000, 20000),
      clicks:        randomBetween(200, 1200),
      currency:      "USD",
    },
    {
      campaign_name: "google_pmax_all_products",
      spend:         randomBetween(200, 800) + Math.random(),
      impressions:   randomBetween(20000, 100000),
      clicks:        randomBetween(400, 2000),
      currency:      "USD",
    },
    {
      campaign_name: "google_display_remarketing",
      spend:         randomBetween(30, 120) + Math.random(),
      impressions:   randomBetween(40000, 200000),
      clicks:        randomBetween(60, 300),
      currency:      "USD",
    },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
