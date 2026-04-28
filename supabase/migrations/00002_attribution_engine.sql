-- ============================================================================
-- NEXUS TRACKER OS — Phase 4: Attribution Engine
-- Multi-touch attribution functions + materialized ROAS view
-- Supabase (PostgreSQL 15+)
-- ============================================================================
-- Migration: 00002_attribution_engine.sql
-- Created:   2026-04-28
--
-- This file creates:
--   1. get_first_click_touch()  — window function helper
--   2. get_last_click_touch()   — window function helper
--   3. fn_attribution_report()  — callable RPC returning full ROAS report
--   4. mv_campaign_roas         — materialized view for dashboard performance
--   5. Refresh function + index on the materialized view
-- ============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: FIRST-CLICK ATTRIBUTION FUNCTION
-- ══════════════════════════════════════════════════════════════════════════════
-- Returns a table of (conversion_id → first attributed touch) pairs.
--
-- Logic:
--   For each conversion, find the EARLIEST page_view that:
--     • shares the same workspace_id AND anonymous_fingerprint_id
--     • has a non-null utm_source (i.e. a paid/trackable touch)
--   There is NO time constraint relative to the conversion — we want the
--   absolute first touch in the user's entire journey, even if it was weeks
--   before the purchase. This answers: "What channel INTRODUCED this user?"
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_first_click_touches(p_workspace_id UUID)
RETURNS TABLE (
    conversion_id  UUID,
    touch_id       UUID,
    utm_source     TEXT,
    utm_campaign   TEXT,
    utm_medium     TEXT,
    touch_ts       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    /*
     * CTE breakdown:
     *
     * ranked_touches:
     *   Joins conversions → page_views on fingerprint + workspace.
     *   Filters to page_views that have a valid utm_source.
     *   Ranks them with ROW_NUMBER() ordered by created_at ASC (earliest first).
     *   PARTITION BY conversion id ensures we pick ONE first-touch per conversion.
     */
    WITH ranked_touches AS (
        SELECT
            c.id               AS conversion_id,
            pv.id              AS touch_id,
            pv.utm_source,
            pv.utm_campaign,
            pv.utm_medium,
            pv.created_at      AS touch_ts,
            ROW_NUMBER() OVER (
                PARTITION BY c.id
                ORDER BY pv.created_at ASC  -- earliest touch wins
            ) AS rn
        FROM public.conversions  c
        JOIN public.page_views   pv
          ON pv.workspace_id             = c.workspace_id
         AND pv.anonymous_fingerprint_id = c.anonymous_fingerprint_id
        WHERE c.workspace_id = p_workspace_id
          AND pv.utm_source IS NOT NULL    -- only trackable touches
    )
    SELECT
        conversion_id,
        touch_id,
        utm_source,
        utm_campaign,
        utm_medium,
        touch_ts
    FROM ranked_touches
    WHERE rn = 1;
$$;

COMMENT ON FUNCTION public.get_first_click_touches(UUID) IS
    'Returns the earliest UTM-tagged page_view for each conversion in a workspace (first-click attribution).';


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: LAST-CLICK ATTRIBUTION FUNCTION
-- ══════════════════════════════════════════════════════════════════════════════
-- Returns a table of (conversion_id → last attributed touch) pairs.
--
-- Logic:
--   For each conversion, find the MOST RECENT page_view that:
--     • shares the same workspace_id AND anonymous_fingerprint_id
--     • has a non-null utm_source
--     • occurred STRICTLY BEFORE the conversion timestamp
--   This answers: "What was the LAST paid channel before the user converted?"
--
-- The strict "before" constraint (pv.created_at < c.created_at) prevents
-- post-conversion page views from receiving credit.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_last_click_touches(p_workspace_id UUID)
RETURNS TABLE (
    conversion_id  UUID,
    touch_id       UUID,
    utm_source     TEXT,
    utm_campaign   TEXT,
    utm_medium     TEXT,
    touch_ts       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    /*
     * CTE breakdown:
     *
     * ranked_touches:
     *   Same join as first-click, but adds the constraint:
     *     pv.created_at < c.created_at   (touch must precede conversion)
     *   Ranks with ROW_NUMBER() ordered by created_at DESC (most recent first).
     */
    WITH ranked_touches AS (
        SELECT
            c.id               AS conversion_id,
            pv.id              AS touch_id,
            pv.utm_source,
            pv.utm_campaign,
            pv.utm_medium,
            pv.created_at      AS touch_ts,
            ROW_NUMBER() OVER (
                PARTITION BY c.id
                ORDER BY pv.created_at DESC  -- most recent touch wins
            ) AS rn
        FROM public.conversions  c
        JOIN public.page_views   pv
          ON pv.workspace_id             = c.workspace_id
         AND pv.anonymous_fingerprint_id = c.anonymous_fingerprint_id
        WHERE c.workspace_id = p_workspace_id
          AND pv.utm_source IS NOT NULL
          AND pv.created_at < c.created_at   -- strictly before conversion
    )
    SELECT
        conversion_id,
        touch_id,
        utm_source,
        utm_campaign,
        utm_medium,
        touch_ts
    FROM ranked_touches
    WHERE rn = 1;
$$;

COMMENT ON FUNCTION public.get_last_click_touches(UUID) IS
    'Returns the most recent UTM-tagged page_view before each conversion in a workspace (last-click attribution).';


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: FULL ATTRIBUTION REPORT FUNCTION (callable via Supabase RPC)
-- ══════════════════════════════════════════════════════════════════════════════
-- This is the main function the dashboard calls. It returns one row per
-- (workspace, campaign) with both first-click and last-click revenue,
-- total ad spend, and computed ROAS for each model.
--
-- Usage from the frontend:
--   const { data } = await supabase.rpc('fn_attribution_report', {
--     p_workspace_id: '...',
--     p_date_from: '2026-01-01',
--     p_date_to: '2026-04-28'
--   });
--
-- CTE PIPELINE (5 stages):
--
--   ┌──────────────────┐
--   │  first_click_raw │  ← get_first_click_touches() for this workspace
--   └────────┬─────────┘
--            │
--   ┌────────▼─────────┐
--   │  last_click_raw  │  ← get_last_click_touches() for this workspace
--   └────────┬─────────┘
--            │
--   ┌────────▼──────────────┐
--   │  fc_revenue / lc_rev  │  ← Join with conversions to get revenue per
--   │  (aggregated)         │    campaign, grouped by utm_source + campaign
--   └────────┬──────────────┘
--            │
--   ┌────────▼─────────┐
--   │  spend_agg       │  ← Aggregate ad_spend by platform + campaign
--   └────────┬─────────┘    within the date range
--            │
--   ┌────────▼─────────┐
--   │  FINAL SELECT    │  ← FULL OUTER JOIN fc_revenue, lc_revenue, spend
--   └──────────────────┘    Compute ROAS = revenue / spend
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_attribution_report(
    p_workspace_id  UUID,
    p_date_from     DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
    p_date_to       DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    workspace_id             UUID,
    utm_source               TEXT,
    campaign_name            TEXT,
    -- First-click model
    fc_conversions           BIGINT,
    fc_revenue               NUMERIC(14,2),
    -- Last-click model
    lc_conversions           BIGINT,
    lc_revenue               NUMERIC(14,2),
    -- Ad spend
    total_spend              NUMERIC(14,2),
    total_impressions        BIGINT,
    total_clicks             BIGINT,
    -- Computed ROAS (revenue / spend); NULL when spend = 0
    fc_roas                  NUMERIC(10,4),
    lc_roas                  NUMERIC(10,4)
)
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY INVOKER
AS $$
    WITH
    -- ── CTE 1: First-click touches with conversion values ─────────────
    -- Calls our first-click helper, then joins back to conversions to
    -- get the revenue (value) for each attributed conversion.
    fc_attributed AS (
        SELECT
            fc.utm_source,
            fc.utm_campaign                     AS campaign_name,
            COUNT(DISTINCT fc.conversion_id)    AS conversions,
            COALESCE(SUM(c.value), 0)           AS revenue
        FROM public.get_first_click_touches(p_workspace_id) fc
        JOIN public.conversions c
          ON c.id = fc.conversion_id
        WHERE c.status IN ('paid', 'pending')          -- exclude refunds
          AND c.created_at >= p_date_from
          AND c.created_at <  (p_date_to + INTERVAL '1 day')
        GROUP BY fc.utm_source, fc.utm_campaign
    ),

    -- ── CTE 2: Last-click touches with conversion values ──────────────
    -- Same pattern as above, but using the last-click helper.
    lc_attributed AS (
        SELECT
            lc.utm_source,
            lc.utm_campaign                     AS campaign_name,
            COUNT(DISTINCT lc.conversion_id)    AS conversions,
            COALESCE(SUM(c.value), 0)           AS revenue
        FROM public.get_last_click_touches(p_workspace_id) lc
        JOIN public.conversions c
          ON c.id = lc.conversion_id
        WHERE c.status IN ('paid', 'pending')
          AND c.created_at >= p_date_from
          AND c.created_at <  (p_date_to + INTERVAL '1 day')
        GROUP BY lc.utm_source, lc.utm_campaign
    ),

    -- ── CTE 3: Ad spend aggregation ───────────────────────────────────
    -- Sums ad_spend by platform (≈ utm_source) and campaign_name within
    -- the requested date range. The platform field in ad_spend maps to
    -- utm_source conceptually (e.g. "meta" → "facebook", "google" → "google").
    spend_agg AS (
        SELECT
            a.platform              AS utm_source,
            a.campaign_name,
            COALESCE(SUM(a.spend_amount), 0)  AS total_spend,
            COALESCE(SUM(a.impressions), 0)   AS total_impressions,
            COALESCE(SUM(a.clicks), 0)        AS total_clicks
        FROM public.ad_spend a
        WHERE a.workspace_id = p_workspace_id
          AND a.date >= p_date_from
          AND a.date <= p_date_to
        GROUP BY a.platform, a.campaign_name
    ),

    -- ── CTE 4: Merge all three data sources ───────────────────────────
    -- FULL OUTER JOIN ensures we see:
    --   • Campaigns with spend but no conversions (wasted spend)
    --   • Campaigns with conversions but no tracked spend (organic / other)
    --   • Campaigns with both (the happy path)
    merged AS (
        SELECT
            COALESCE(fc.utm_source, lc.utm_source, s.utm_source)        AS utm_source,
            COALESCE(fc.campaign_name, lc.campaign_name, s.campaign_name) AS campaign_name,
            COALESCE(fc.conversions, 0)  AS fc_conversions,
            COALESCE(fc.revenue, 0)      AS fc_revenue,
            COALESCE(lc.conversions, 0)  AS lc_conversions,
            COALESCE(lc.revenue, 0)      AS lc_revenue,
            COALESCE(s.total_spend, 0)   AS total_spend,
            COALESCE(s.total_impressions, 0) AS total_impressions,
            COALESCE(s.total_clicks, 0)      AS total_clicks
        FROM fc_attributed fc
        FULL OUTER JOIN lc_attributed lc
          ON  lc.utm_source    = fc.utm_source
          AND lc.campaign_name = fc.campaign_name
        FULL OUTER JOIN spend_agg s
          ON  s.utm_source    = COALESCE(fc.utm_source, lc.utm_source)
          AND s.campaign_name = COALESCE(fc.campaign_name, lc.campaign_name)
    )

    -- ── Final SELECT: compute ROAS ────────────────────────────────────
    -- ROAS = Revenue / Spend.  Returns NULL when spend is zero to avoid
    -- division-by-zero and to clearly signal "no spend data available".
    SELECT
        p_workspace_id          AS workspace_id,
        m.utm_source,
        m.campaign_name,
        m.fc_conversions,
        m.fc_revenue,
        m.lc_conversions,
        m.lc_revenue,
        m.total_spend,
        m.total_impressions,
        m.total_clicks,
        CASE WHEN m.total_spend > 0
             THEN ROUND(m.fc_revenue / m.total_spend, 4)
             ELSE NULL
        END AS fc_roas,
        CASE WHEN m.total_spend > 0
             THEN ROUND(m.lc_revenue / m.total_spend, 4)
             ELSE NULL
        END AS lc_roas
    FROM merged m
    ORDER BY m.lc_revenue DESC NULLS LAST, m.fc_revenue DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.fn_attribution_report(UUID, DATE, DATE) IS
    'Returns a full attribution report with first-click and last-click revenue, ad spend, and ROAS per campaign. Callable via supabase.rpc().';


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: MATERIALIZED VIEW — Pre-computed ROAS for Dashboard Performance
-- ══════════════════════════════════════════════════════════════════════════════
-- For high-traffic dashboards, calling fn_attribution_report() on every page
-- load is expensive. This materialized view pre-computes the last 90 days of
-- attribution data across ALL workspaces.
--
-- Refresh strategy:
--   • Scheduled: REFRESH via pg_cron or our node-cron after the ad-spend sync.
--   • On-demand: Call refresh_mv_campaign_roas() from application code.
--   • CONCURRENTLY: allows reads during refresh (requires unique index).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_campaign_roas AS
WITH
-- ── All paid conversions in the last 90 days ──────────────────────────
recent_conversions AS (
    SELECT id, workspace_id, anonymous_fingerprint_id, value, created_at
    FROM public.conversions
    WHERE status IN ('paid', 'pending')
      AND created_at >= (CURRENT_DATE - INTERVAL '90 days')
),

-- ── First-click: earliest UTM touch per conversion ───────────────────
fc AS (
    SELECT
        c.id             AS conversion_id,
        c.workspace_id,
        c.value,
        pv.utm_source,
        pv.utm_campaign  AS campaign_name,
        ROW_NUMBER() OVER (
            PARTITION BY c.id ORDER BY pv.created_at ASC
        ) AS rn
    FROM recent_conversions c
    JOIN public.page_views pv
      ON pv.workspace_id             = c.workspace_id
     AND pv.anonymous_fingerprint_id = c.anonymous_fingerprint_id
    WHERE pv.utm_source IS NOT NULL
),

-- ── Last-click: most recent UTM touch before conversion ──────────────
lc AS (
    SELECT
        c.id             AS conversion_id,
        c.workspace_id,
        c.value,
        pv.utm_source,
        pv.utm_campaign  AS campaign_name,
        ROW_NUMBER() OVER (
            PARTITION BY c.id ORDER BY pv.created_at DESC
        ) AS rn
    FROM recent_conversions c
    JOIN public.page_views pv
      ON pv.workspace_id             = c.workspace_id
     AND pv.anonymous_fingerprint_id = c.anonymous_fingerprint_id
    WHERE pv.utm_source IS NOT NULL
      AND pv.created_at < c.created_at
),

-- ── Aggregate first-click revenue per workspace × campaign ───────────
fc_agg AS (
    SELECT
        workspace_id, utm_source, campaign_name,
        COUNT(*)         AS fc_conversions,
        SUM(value)       AS fc_revenue
    FROM fc WHERE rn = 1
    GROUP BY workspace_id, utm_source, campaign_name
),

-- ── Aggregate last-click revenue per workspace × campaign ────────────
lc_agg AS (
    SELECT
        workspace_id, utm_source, campaign_name,
        COUNT(*)         AS lc_conversions,
        SUM(value)       AS lc_revenue
    FROM lc WHERE rn = 1
    GROUP BY workspace_id, utm_source, campaign_name
),

-- ── Aggregate ad spend (last 90 days) ────────────────────────────────
spend_agg AS (
    SELECT
        workspace_id,
        platform          AS utm_source,
        campaign_name,
        SUM(spend_amount) AS total_spend,
        SUM(impressions)  AS total_impressions,
        SUM(clicks)       AS total_clicks
    FROM public.ad_spend
    WHERE date >= (CURRENT_DATE - INTERVAL '90 days')
    GROUP BY workspace_id, platform, campaign_name
)

-- ── Final merge ──────────────────────────────────────────────────────
SELECT
    COALESCE(fc.workspace_id, lc.workspace_id, s.workspace_id) AS workspace_id,
    COALESCE(fc.utm_source, lc.utm_source, s.utm_source)       AS utm_source,
    COALESCE(fc.campaign_name, lc.campaign_name, s.campaign_name) AS campaign_name,
    COALESCE(fc.fc_conversions, 0) AS fc_conversions,
    COALESCE(fc.fc_revenue, 0)     AS fc_revenue,
    COALESCE(lc.lc_conversions, 0) AS lc_conversions,
    COALESCE(lc.lc_revenue, 0)     AS lc_revenue,
    COALESCE(s.total_spend, 0)     AS total_spend,
    COALESCE(s.total_impressions, 0) AS total_impressions,
    COALESCE(s.total_clicks, 0)      AS total_clicks,
    CASE WHEN COALESCE(s.total_spend, 0) > 0
         THEN ROUND(COALESCE(fc.fc_revenue, 0) / s.total_spend, 4)
         ELSE NULL
    END AS fc_roas,
    CASE WHEN COALESCE(s.total_spend, 0) > 0
         THEN ROUND(COALESCE(lc.lc_revenue, 0) / s.total_spend, 4)
         ELSE NULL
    END AS lc_roas
FROM fc_agg fc
FULL OUTER JOIN lc_agg lc
  ON  lc.workspace_id  = fc.workspace_id
  AND lc.utm_source    = fc.utm_source
  AND lc.campaign_name = fc.campaign_name
FULL OUTER JOIN spend_agg s
  ON  s.workspace_id  = COALESCE(fc.workspace_id, lc.workspace_id)
  AND s.utm_source    = COALESCE(fc.utm_source, lc.utm_source)
  AND s.campaign_name = COALESCE(fc.campaign_name, lc.campaign_name)
WITH NO DATA;   -- create empty; first REFRESH populates it

COMMENT ON MATERIALIZED VIEW public.mv_campaign_roas IS
    'Pre-computed 90-day attribution report. Refresh after ad_spend sync completes.';


-- ── Unique index required for REFRESH CONCURRENTLY ───────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_roas_ws_source_campaign
    ON public.mv_campaign_roas (workspace_id, utm_source, campaign_name);

-- ── Additional index for per-workspace dashboard queries ─────────────
CREATE INDEX IF NOT EXISTS idx_mv_roas_workspace
    ON public.mv_campaign_roas (workspace_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: REFRESH HELPER FUNCTION
-- ══════════════════════════════════════════════════════════════════════════════
-- Wraps REFRESH MATERIALIZED VIEW CONCURRENTLY so it can be called from
-- application code via supabase.rpc('refresh_mv_campaign_roas').
-- CONCURRENTLY means the view remains readable during the refresh.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refresh_mv_campaign_roas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_campaign_roas;
END;
$$;

COMMENT ON FUNCTION public.refresh_mv_campaign_roas() IS
    'Refreshes the mv_campaign_roas materialized view concurrently (non-blocking reads).';

-- Grant execute to authenticated users (dashboard refresh button).
GRANT EXECUTE ON FUNCTION public.refresh_mv_campaign_roas() TO authenticated;

-- Grant execute on the RPC functions to authenticated users.
GRANT EXECUTE ON FUNCTION public.fn_attribution_report(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_first_click_touches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_last_click_touches(UUID) TO authenticated;

-- Grant read on the materialized view.
GRANT SELECT ON public.mv_campaign_roas TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: INITIAL REFRESH
-- ══════════════════════════════════════════════════════════════════════════════
-- Populate the materialized view for the first time.
-- Note: Cannot use CONCURRENTLY on first refresh (no data yet), so we use
-- a regular REFRESH here. Subsequent refreshes use CONCURRENTLY.
-- ══════════════════════════════════════════════════════════════════════════════

REFRESH MATERIALIZED VIEW public.mv_campaign_roas;
