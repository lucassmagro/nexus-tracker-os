/**
 * Meta Marketing API — Mock Integration
 * ──────────────────────────────────────
 * Simulates fetching daily ad spend from the Meta (Facebook) Marketing API.
 *
 * REAL IMPLEMENTATION NOTES:
 * ─────────────────────────
 * SDK:        facebook-nodejs-business-sdk
 * Auth:       OAuth 2.0 long-lived user/system token stored per workspace
 * Endpoint:   GET /{ad_account_id}/insights
 * Parameters:
 *   - level:        "campaign"
 *   - fields:       "campaign_name,spend,impressions,clicks"
 *   - time_range:   { since: "YYYY-MM-DD", until: "YYYY-MM-DD" }
 *   - time_increment: 1  (daily granularity)
 * Rate limits: 200 calls / hour / ad account (use batch API for scale)
 *
 * The mock returns realistic-looking data so the rest of the pipeline
 * can be tested end-to-end without real Meta credentials.
 */

/** @typedef {{ campaign_name: string, spend: number, impressions: number, clicks: number, currency: string }} MetaSpendRow */

/**
 * Mock: Fetch yesterday's ad spend from Meta for a given workspace.
 *
 * @param {object}  workspace            - Workspace config
 * @param {string}  workspace.id         - Workspace UUID
 * @param {string}  workspace.meta_token - Meta API access token (would be real)
 * @param {string}  workspace.meta_ad_account_id - Meta ad account ID
 * @param {string}  dateStr              - The date to fetch spend for (YYYY-MM-DD)
 * @returns {Promise<MetaSpendRow[]>}
 * @throws {Error} Simulates token expiration for workspaces with expired tokens
 */
export async function fetchMetaAdSpend(workspace, dateStr) {
  // ── Simulate token expiration ──────────────────────────────────────────
  if (workspace.meta_token === "EXPIRED") {
    throw new Error(
      `Meta token expired for workspace "${workspace.id}". ` +
      `Re-authenticate at: https://developers.facebook.com/tools/explorer/`
    );
  }

  // ── Simulate API latency ───────────────────────────────────────────────
  await sleep(randomBetween(100, 400));

  // ── Mock response ──────────────────────────────────────────────────────
  // In production, this would be:
  //
  //   const adAccount = new AdAccount(workspace.meta_ad_account_id);
  //   const insights = await adAccount.getInsights(
  //     ["campaign_name", "spend", "impressions", "clicks"],
  //     {
  //       level: "campaign",
  //       time_range: { since: dateStr, until: dateStr },
  //       time_increment: 1,
  //     }
  //   );
  //   return insights.map(row => ({
  //     campaign_name: row.campaign_name,
  //     spend:         parseFloat(row.spend),
  //     impressions:   parseInt(row.impressions, 10),
  //     clicks:        parseInt(row.clicks, 10),
  //     currency:      "USD",
  //   }));

  return [
    {
      campaign_name: "meta_retargeting_cart_abandoners",
      spend:         randomBetween(80, 350) + Math.random(),
      impressions:   randomBetween(8000, 45000),
      clicks:        randomBetween(120, 900),
      currency:      "USD",
    },
    {
      campaign_name: "meta_lookalike_top_purchasers",
      spend:         randomBetween(150, 600) + Math.random(),
      impressions:   randomBetween(15000, 80000),
      clicks:        randomBetween(200, 1500),
      currency:      "USD",
    },
    {
      campaign_name: "meta_brand_awareness_broad",
      spend:         randomBetween(50, 200) + Math.random(),
      impressions:   randomBetween(30000, 120000),
      clicks:        randomBetween(80, 400),
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
