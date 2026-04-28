/**
 * Ad Spend Sync Job
 * ─────────────────
 * Fetches the previous day's ad spend from all connected platforms for
 * every active workspace and upserts the data into the `ad_spend` table.
 *
 * Design principles:
 *   • Workspace isolation — a failure in workspace A never blocks B.
 *   • Idempotency — uses Supabase upsert with the unique constraint
 *     (workspace_id, platform, campaign_name, date) from the schema.
 *   • Observability — structured logs for every step, tagged by workspace.
 *   • Extensibility — adding a new platform = add one entry to PLATFORM_FETCHERS.
 */
import { supabase } from "../config/supabase.js";
import { fetchMetaAdSpend } from "../integrations/metaAds.js";
import { fetchGoogleAdSpend } from "../integrations/googleAds.js";

// ── Platform Registry ─────────────────────────────────────────────────────
// Maps platform names to their fetcher functions and the workspace fields
// needed to determine if the integration is active.
const PLATFORM_FETCHERS = [
  {
    platform: "meta",
    fetcher:  fetchMetaAdSpend,
    /** A workspace has Meta connected if it has a token + ad account ID. */
    isActive: (ws) => !!ws.meta_token && !!ws.meta_ad_account_id,
  },
  {
    platform: "google",
    fetcher:  fetchGoogleAdSpend,
    /** A workspace has Google Ads connected if it has a refresh token + customer ID. */
    isActive: (ws) => !!ws.google_refresh_token && !!ws.google_customer_id,
  },
  // ── Add new platforms here ─────────────────────────────────────────────
  // {
  //   platform: "tiktok",
  //   fetcher:  fetchTikTokAdSpend,
  //   isActive: (ws) => !!ws.tiktok_token,
  // },
];

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns yesterday's date as YYYY-MM-DD in UTC.
 * Ad platforms report on completed calendar days, so we always pull T-1.
 */
function getYesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Formats a duration in milliseconds as a human-readable string.
 */
function elapsed(startMs) {
  return `${((Date.now() - startMs) / 1000).toFixed(1)}s`;
}

// ── Core Job ──────────────────────────────────────────────────────────────

/**
 * Fetches all active workspaces from the database.
 *
 * In a production system, you'd also join on an `integrations` table to get
 * per-workspace tokens. For now, we use mock workspaces for local testing.
 *
 * @returns {Promise<object[]>}
 */
async function getActiveWorkspaces() {
  // ── MOCK workspaces for local development ──────────────────────────────
  // Replace this block with a real Supabase query once the integrations
  // table exists:
  //
  //   const { data, error } = await supabase
  //     .from("workspaces")
  //     .select(`
  //       id, name,
  //       integrations (
  //         platform, access_token, refresh_token, account_id, active
  //       )
  //     `)
  //     .eq("integrations.active", true);

  return [
    {
      id:                     "00000000-0000-0000-0000-000000000001",
      name:                   "Acme Corp",
      meta_token:             "mock-meta-token-acme",
      meta_ad_account_id:     "act_123456789",
      google_refresh_token:   "mock-google-refresh-acme",
      google_customer_id:     "123-456-7890",
    },
    {
      id:                     "00000000-0000-0000-0000-000000000002",
      name:                   "Globex Inc",
      meta_token:             "mock-meta-token-globex",
      meta_ad_account_id:     "act_987654321",
      google_refresh_token:   "EXPIRED", // ← simulates token expiration
      google_customer_id:     "098-765-4321",
    },
    {
      id:                     "00000000-0000-0000-0000-000000000003",
      name:                   "Initech LLC",
      meta_token:             "EXPIRED", // ← simulates token expiration
      meta_ad_account_id:     "act_555555555",
      google_refresh_token:   null,       // ← Google Ads not connected
      google_customer_id:     null,
    },
  ];
}

/**
 * Upserts an array of spend rows into the `ad_spend` table.
 * Uses the unique constraint (workspace_id, platform, campaign_name, date)
 * to handle re-runs and duplicate data gracefully.
 *
 * @param {object[]} rows - Array of ad_spend rows ready for insert
 * @returns {Promise<{inserted: number, errors: string[]}>}
 */
async function upsertAdSpend(rows) {
  if (rows.length === 0) return { inserted: 0, errors: [] };

  const { data, error } = await supabase
    .from("ad_spend")
    .upsert(rows, {
      onConflict: "workspace_id,platform,campaign_name,date",
      ignoreDuplicates: false, // UPDATE on conflict (spend may be revised)
    })
    .select("id");

  if (error) {
    return { inserted: 0, errors: [error.message] };
  }

  return { inserted: data?.length ?? rows.length, errors: [] };
}

/**
 * Processes a single platform for a single workspace.
 *
 * @param {object} workspace    - The workspace object
 * @param {object} platformCfg  - Entry from PLATFORM_FETCHERS
 * @param {string} dateStr      - YYYY-MM-DD
 * @returns {Promise<object[]>} - Rows ready for upsert
 */
async function fetchPlatformSpend(workspace, platformCfg, dateStr) {
  const rows = await platformCfg.fetcher(workspace, dateStr);

  // Map the platform response to the ad_spend schema.
  return rows.map((row) => ({
    workspace_id:  workspace.id,
    platform:      platformCfg.platform,
    campaign_name: row.campaign_name,
    spend_amount:  Math.round(row.spend * 100) / 100, // round to 2 decimals
    currency:      row.currency || "USD",
    impressions:   row.impressions ?? null,
    clicks:        row.clicks ?? null,
    date:          dateStr,
  }));
}

/**
 * Main entry point — runs the full ad spend sync across all workspaces
 * and platforms. Designed to be called by the cron scheduler.
 *
 * Error handling strategy:
 *   • Per-workspace: caught and logged; processing continues.
 *   • Per-platform:  caught and logged; other platforms still run.
 *   • The job NEVER throws — the cron scheduler always completes cleanly.
 */
export async function runAdSpendSync() {
  const jobStart = Date.now();
  const dateStr  = getYesterdayUTC();

  console.log("─".repeat(70));
  console.log(`[ad-spend] Starting daily sync for date: ${dateStr}`);
  console.log("─".repeat(70));

  // ── Fetch active workspaces ────────────────────────────────────────────
  let workspaces;
  try {
    workspaces = await getActiveWorkspaces();
    console.log(`[ad-spend] Found ${workspaces.length} active workspace(s).`);
  } catch (err) {
    console.error("[ad-spend] FATAL — Failed to fetch workspaces:", err.message);
    return;
  }

  // ── Aggregate results ──────────────────────────────────────────────────
  const summary = {
    totalWorkspaces:  workspaces.length,
    successWorkspaces: 0,
    failedWorkspaces:  0,
    totalRows:         0,
    errors:           [],
  };

  // ── Process each workspace ─────────────────────────────────────────────
  for (const workspace of workspaces) {
    const wsStart = Date.now();
    const wsTag   = `[ad-spend] [${workspace.name}] (${workspace.id})`;
    let wsHadError = false;
    let wsRowCount = 0;

    console.log(`\n${wsTag} Processing...`);

    for (const platformCfg of PLATFORM_FETCHERS) {
      // Skip platforms not connected for this workspace.
      if (!platformCfg.isActive(workspace)) {
        console.log(`${wsTag} [${platformCfg.platform}] ⏭  Not connected — skipping.`);
        continue;
      }

      try {
        console.log(`${wsTag} [${platformCfg.platform}] Fetching spend...`);

        const rows = await fetchPlatformSpend(workspace, platformCfg, dateStr);
        console.log(`${wsTag} [${platformCfg.platform}] Received ${rows.length} campaign(s).`);

        // Upsert into Supabase.
        const result = await upsertAdSpend(rows);

        if (result.errors.length > 0) {
          wsHadError = true;
          for (const err of result.errors) {
            const msg = `${wsTag} [${platformCfg.platform}] DB upsert error: ${err}`;
            console.error(msg);
            summary.errors.push(msg);
          }
        } else {
          wsRowCount += result.inserted;
          console.log(
            `${wsTag} [${platformCfg.platform}] ✓ Upserted ${result.inserted} row(s).`
          );
        }
      } catch (err) {
        // ── Per-platform error — log and continue ────────────────────────
        wsHadError = true;
        const msg = `${wsTag} [${platformCfg.platform}] ✗ ERROR: ${err.message}`;
        console.error(msg);
        summary.errors.push(msg);
      }
    }

    // ── Workspace summary ────────────────────────────────────────────────
    summary.totalRows += wsRowCount;

    if (wsHadError) {
      summary.failedWorkspaces++;
      console.warn(`${wsTag} Completed with errors (${elapsed(wsStart)}).`);
    } else {
      summary.successWorkspaces++;
      console.log(`${wsTag} ✓ Done — ${wsRowCount} rows (${elapsed(wsStart)}).`);
    }
  }

  // ── Job summary ────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(70));
  console.log(`[ad-spend] Daily sync completed in ${elapsed(jobStart)}.`);
  console.log(`[ad-spend]   Workspaces: ${summary.successWorkspaces} ok, ${summary.failedWorkspaces} with errors`);
  console.log(`[ad-spend]   Rows upserted: ${summary.totalRows}`);

  if (summary.errors.length > 0) {
    console.log(`[ad-spend]   Errors (${summary.errors.length}):`);
    for (const e of summary.errors) {
      console.log(`[ad-spend]     → ${e}`);
    }
  }

  console.log("─".repeat(70));

  return summary;
}
