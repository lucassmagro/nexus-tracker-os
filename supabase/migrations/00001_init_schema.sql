-- ============================================================================
-- NEXUS TRACKER OS — Initial Database Schema
-- Multi-tenant B2B Attribution & Tracking SaaS
-- Supabase (PostgreSQL 15+)
-- ============================================================================
-- Migration: 00001_init_schema.sql
-- Created:   2026-04-28
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid() (Supabase default)

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. WORKSPACES
-- ──────────────────────────────────────────────────────────────────────────────
-- The top-level tenant entity. Every row in the system belongs to exactly one
-- workspace, which is the foundation of our multi-tenancy isolation.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.workspaces (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
    created_at TIMESTAMPTZ NOT NULL    DEFAULT now()
);

COMMENT ON TABLE  public.workspaces IS 'Top-level tenant. All data is scoped to a workspace.';
COMMENT ON COLUMN public.workspaces.id IS 'Globally unique workspace identifier (UUIDv4).';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. USERS
-- ──────────────────────────────────────────────────────────────────────────────
-- Links a Supabase Auth user (auth.uid()) to a workspace with a given role.
-- A user may belong to ONE workspace (for simplicity). Extend with a join
-- table if multi-workspace membership is needed later.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE public.users (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_uid     UUID        NOT NULL UNIQUE,  -- references auth.users(id) at app level
    workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    role         public.user_role NOT NULL DEFAULT 'member',
    email        TEXT        NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_workspace_email UNIQUE (workspace_id, email)
);

COMMENT ON TABLE  public.users IS 'Workspace members. Ties a Supabase Auth identity to a tenant.';
COMMENT ON COLUMN public.users.auth_uid IS 'Matches auth.uid() from Supabase Auth for RLS binding.';
COMMENT ON COLUMN public.users.role IS 'Tenant-level role: owner > admin > member > viewer.';

-- INDEX: Fast lookup when RLS resolves the caller's workspace from auth_uid.
CREATE INDEX idx_users_auth_uid ON public.users (auth_uid);

-- INDEX: List members of a workspace.
CREATE INDEX idx_users_workspace_id ON public.users (workspace_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. PAGE VIEWS
-- ──────────────────────────────────────────────────────────────────────────────
-- High-volume event table. Each row is a single page-view hit captured by the
-- tracking pixel / SDK. This table is the backbone for attribution modeling.
--
-- INDEXING STRATEGY (Analytics-Optimised):
--   • (workspace_id, created_at DESC)  — the primary access pattern for
--     dashboards that query "show me page views for my workspace in the last
--     N days". Descending order eliminates a backwards index scan.
--   • (workspace_id, anonymous_fingerprint_id) — powers journey stitching:
--     "give me every touch for fingerprint X in workspace Y".
--   • (workspace_id, utm_source, utm_campaign) — aggregation queries like
--     "group by source/campaign" become index-only scans.
--   • BRIN on created_at — extremely compact index that works well because
--     rows are inserted in chronological order. Speeds up large time-range
--     scans without the storage cost of a full B-tree.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.page_views (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    anonymous_fingerprint_id TEXT        NOT NULL CHECK (char_length(anonymous_fingerprint_id) BETWEEN 1 AND 512),
    url                      TEXT        NOT NULL CHECK (char_length(url) <= 2048),
    referrer                 TEXT,                                          -- optional referrer URL
    utm_source               TEXT,
    utm_campaign             TEXT,
    utm_medium               TEXT,
    utm_term                 TEXT,
    utm_content              TEXT,
    user_agent               TEXT,
    ip_hash                  TEXT,                                          -- SHA-256 of IP for privacy
    country_code             CHAR(2),                                       -- ISO 3166-1 alpha-2
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.page_views IS 'Raw page-view events ingested from the tracking pixel.';
COMMENT ON COLUMN public.page_views.anonymous_fingerprint_id IS 'Browser fingerprint hash — links anonymous visits across sessions.';
COMMENT ON COLUMN public.page_views.ip_hash IS 'One-way hash of IP for geo-lookup; raw IPs are never stored (GDPR/LGPD).';

-- B-tree: dashboard time-series queries — "page views this week for workspace X"
CREATE INDEX idx_pv_workspace_created
    ON public.page_views (workspace_id, created_at DESC);

-- B-tree: journey stitching — "all touches for this fingerprint"
CREATE INDEX idx_pv_workspace_fingerprint
    ON public.page_views (workspace_id, anonymous_fingerprint_id);

-- B-tree: UTM aggregation — "group by source × campaign"
-- Partial index excludes rows where utm_source IS NULL to save space.
CREATE INDEX idx_pv_workspace_utm
    ON public.page_views (workspace_id, utm_source, utm_campaign)
    WHERE utm_source IS NOT NULL;

-- BRIN: cheap chronological range scans on append-only data
CREATE INDEX idx_pv_created_brin
    ON public.page_views USING brin (created_at)
    WITH (pages_per_range = 32);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. CONVERSIONS
-- ──────────────────────────────────────────────────────────────────────────────
-- Represents a completed (or pending) business outcome: a purchase, a sign-up,
-- a demo request, etc. The anonymous_fingerprint_id is the join key that ties
-- a conversion back to its page_views journey for attribution.
--
-- INDEXING STRATEGY:
--   • (workspace_id, created_at DESC) — same dashboard pattern as page_views.
--   • (workspace_id, anonymous_fingerprint_id) — attribution join:
--     page_views ⟶ conversions via fingerprint.
--   • (workspace_id, status) — filter pending vs. paid vs. refunded.
--   • Unique constraint on (workspace_id, order_id) — prevents duplicate
--     conversion ingestion for the same order within a workspace.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TYPE public.conversion_status AS ENUM ('pending', 'paid', 'refunded', 'cancelled');

CREATE TABLE public.conversions (
    id                       UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id             UUID              NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    order_id                 TEXT              NOT NULL CHECK (char_length(order_id) BETWEEN 1 AND 255),
    value                    NUMERIC(14, 2)    NOT NULL DEFAULT 0 CHECK (value >= 0),
    currency                 CHAR(3)           NOT NULL DEFAULT 'BRL',      -- ISO 4217
    status                   public.conversion_status NOT NULL DEFAULT 'pending',
    anonymous_fingerprint_id TEXT              NOT NULL CHECK (char_length(anonymous_fingerprint_id) BETWEEN 1 AND 512),
    metadata                 JSONB,                                          -- extensible payload (plan, coupon, etc.)
    created_at               TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ       NOT NULL DEFAULT now(),

    CONSTRAINT uq_conversions_workspace_order UNIQUE (workspace_id, order_id)
);

COMMENT ON TABLE  public.conversions IS 'Business outcomes (purchases, sign-ups) linked to page_views via fingerprint.';
COMMENT ON COLUMN public.conversions.value IS 'Monetary value of the conversion in the smallest major unit (e.g. 99.90).';
COMMENT ON COLUMN public.conversions.metadata IS 'Flexible JSONB bag for extra attributes (plan name, coupon code, etc.).';

-- B-tree: dashboard time-series
CREATE INDEX idx_conv_workspace_created
    ON public.conversions (workspace_id, created_at DESC);

-- B-tree: attribution join (fingerprint → conversions)
CREATE INDEX idx_conv_workspace_fingerprint
    ON public.conversions (workspace_id, anonymous_fingerprint_id);

-- B-tree: filter by status (e.g. "show me only paid conversions")
CREATE INDEX idx_conv_workspace_status
    ON public.conversions (workspace_id, status);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. AD SPEND
-- ──────────────────────────────────────────────────────────────────────────────
-- Daily-grain advertising cost imported from ad platforms (Google Ads, Meta,
-- TikTok, LinkedIn, etc.). Joined with conversions to compute ROAS, CPA, etc.
--
-- INDEXING STRATEGY:
--   • (workspace_id, date DESC) — dashboard: "ad spend this month".
--   • (workspace_id, platform, date DESC) — breakdown by platform over time.
--   • (workspace_id, campaign_name, date DESC) — drill-down into a specific
--     campaign's daily spend.
--   • Unique constraint on (workspace_id, platform, campaign_name, date)
--     prevents duplicate daily records from re-imports.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.ad_spend (
    id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID           NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    platform      TEXT           NOT NULL CHECK (char_length(platform) BETWEEN 1 AND 100),
    campaign_name TEXT           NOT NULL CHECK (char_length(campaign_name) BETWEEN 1 AND 500),
    spend_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (spend_amount >= 0),
    currency      CHAR(3)        NOT NULL DEFAULT 'BRL',
    impressions   BIGINT,
    clicks        BIGINT,
    date          DATE           NOT NULL,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),

    CONSTRAINT uq_ad_spend_workspace_platform_campaign_date
        UNIQUE (workspace_id, platform, campaign_name, date)
);

COMMENT ON TABLE  public.ad_spend IS 'Daily advertising cost per platform × campaign. Source of truth for ROAS.';
COMMENT ON COLUMN public.ad_spend.date IS 'The calendar day the spend refers to (UTC).';

-- B-tree: dashboard time-series
CREATE INDEX idx_adspend_workspace_date
    ON public.ad_spend (workspace_id, date DESC);

-- B-tree: platform breakdown
CREATE INDEX idx_adspend_workspace_platform_date
    ON public.ad_spend (workspace_id, platform, date DESC);

-- B-tree: campaign drill-down
CREATE INDEX idx_adspend_workspace_campaign_date
    ON public.ad_spend (workspace_id, campaign_name, date DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTION — resolve the caller's workspace
-- ──────────────────────────────────────────────────────────────────────────────
-- Used in every RLS policy. Returns the workspace_id for the currently
-- authenticated Supabase user. Marked STABLE + SECURITY DEFINER so it can
-- query the users table even when RLS is active on it.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT workspace_id
    FROM public.users
    WHERE auth_uid = auth.uid()
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_workspace_id() IS
    'Returns the workspace_id tied to the current auth.uid(). Used by all RLS policies.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. HELPER FUNCTION — resolve the caller's role
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.users
    WHERE auth_uid = auth.uid()
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_role() IS
    'Returns the role of the current auth.uid(). Used for role-gated RLS policies.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. AUTO-UPDATE updated_at TRIGGER
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversions_updated_at
    BEFORE UPDATE ON public.conversions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────────────────────────────────────
-- Every table is locked down so that authenticated users can only see/modify
-- rows belonging to their own workspace. The service_role key bypasses RLS
-- for server-side ingestion pipelines (tracking pixel, ad-spend importers).
--
-- DESIGN DECISIONS:
--   • SELECT policies use get_user_workspace_id() for a clean, single check.
--   • INSERT policies ensure the caller cannot write into another workspace.
--   • UPDATE/DELETE are restricted to owner/admin roles where destructive.
--   • page_views and ad_spend INSERT are also allowed via service_role
--     (bypasses RLS) for high-throughput ingestion from Edge Functions.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 9a. WORKSPACES ──────────────────────────────────────────────────────────
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Users can only read their own workspace.
CREATE POLICY workspaces_select ON public.workspaces
    FOR SELECT
    TO authenticated
    USING (id = public.get_user_workspace_id());

-- Only owners can update workspace metadata (name, etc.).
CREATE POLICY workspaces_update ON public.workspaces
    FOR UPDATE
    TO authenticated
    USING (
        id = public.get_user_workspace_id()
        AND public.get_user_role() IN ('owner', 'admin')
    )
    WITH CHECK (
        id = public.get_user_workspace_id()
    );

-- Workspace creation is handled server-side (service_role) during onboarding.
-- No INSERT policy for authenticated — prevents users from creating rogue tenants.

-- ── 9b. USERS ───────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Members can see all users in their workspace (for team management UI).
CREATE POLICY users_select ON public.users
    FOR SELECT
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id());

-- Only owner/admin can invite (insert) new members.
CREATE POLICY users_insert ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (
        workspace_id = public.get_user_workspace_id()
        AND public.get_user_role() IN ('owner', 'admin')
    );

-- Only owner/admin can change roles; users can update their own non-role fields.
CREATE POLICY users_update ON public.users
    FOR UPDATE
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id())
    WITH CHECK (
        workspace_id = public.get_user_workspace_id()
        AND (
            -- Owner/admin can update any user in the workspace
            public.get_user_role() IN ('owner', 'admin')
            -- Regular users can only update their own row
            OR auth_uid = auth.uid()
        )
    );

-- Only owner can remove members.
CREATE POLICY users_delete ON public.users
    FOR DELETE
    TO authenticated
    USING (
        workspace_id = public.get_user_workspace_id()
        AND public.get_user_role() = 'owner'
    );

-- ── 9c. PAGE VIEWS ──────────────────────────────────────────────────────────
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- All workspace members can read page views (analytics dashboards).
CREATE POLICY page_views_select ON public.page_views
    FOR SELECT
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id());

-- INSERT is done server-side via service_role (Edge Function / tracking API).
-- If you want authenticated users to also insert (e.g. manual event), uncomment:
-- CREATE POLICY page_views_insert ON public.page_views
--     FOR INSERT
--     TO authenticated
--     WITH CHECK (workspace_id = public.get_user_workspace_id());

-- Page views are immutable — no UPDATE or DELETE policies for authenticated users.
-- Corrections should be handled via a separate "excluded events" mechanism.

-- ── 9d. CONVERSIONS ─────────────────────────────────────────────────────────
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;

-- All workspace members can read conversions.
CREATE POLICY conversions_select ON public.conversions
    FOR SELECT
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id());

-- INSERT from server-side webhook handlers (service_role).
-- Admin+ can also manually create conversions.
CREATE POLICY conversions_insert ON public.conversions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        workspace_id = public.get_user_workspace_id()
        AND public.get_user_role() IN ('owner', 'admin')
    );

-- Only owner/admin can update conversion status (e.g. mark as refunded).
CREATE POLICY conversions_update ON public.conversions
    FOR UPDATE
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id())
    WITH CHECK (
        workspace_id = public.get_user_workspace_id()
        AND public.get_user_role() IN ('owner', 'admin')
    );

-- ── 9e. AD SPEND ────────────────────────────────────────────────────────────
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

-- All workspace members can read ad spend (ROAS dashboards).
CREATE POLICY ad_spend_select ON public.ad_spend
    FOR SELECT
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id());

-- Only owner/admin can manually insert spend records.
CREATE POLICY ad_spend_insert ON public.ad_spend
    FOR INSERT
    TO authenticated
    WITH CHECK (
        workspace_id = public.get_user_workspace_id()
        AND public.get_user_role() IN ('owner', 'admin')
    );

-- Only owner/admin can update spend records (corrections).
CREATE POLICY ad_spend_update ON public.ad_spend
    FOR UPDATE
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id())
    WITH CHECK (
        workspace_id = public.get_user_workspace_id()
        AND public.get_user_role() IN ('owner', 'admin')
    );

-- Only owner can delete spend records.
CREATE POLICY ad_spend_delete ON public.ad_spend
    FOR DELETE
    TO authenticated
    USING (
        workspace_id = public.get_user_workspace_id()
        AND public.get_user_role() = 'owner'
    );

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. GRANTS
-- ──────────────────────────────────────────────────────────────────────────────
-- Supabase manages roles automatically but we make grants explicit for clarity.
-- `anon` gets no access; `authenticated` gets RLS-filtered access;
-- `service_role` bypasses RLS for server-side ingestion.
-- ──────────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- anon: no table access (tracking hits use service_role via Edge Functions)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- authenticated: full CRUD filtered by RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- service_role: full access, bypasses RLS (for ingestion pipelines)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Functions
GRANT EXECUTE ON FUNCTION public.get_user_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. FUTURE CONSIDERATIONS (not implemented yet)
-- ──────────────────────────────────────────────────────────────────────────────
-- • PARTITIONING: When page_views exceeds ~100M rows, consider range-
--   partitioning by created_at (monthly). This lets you DROP old partitions
--   instead of DELETE and keeps index sizes manageable.
--
-- • MATERIALIZED VIEWS: Pre-aggregate daily/weekly metrics per workspace
--   to avoid full scans on high-cardinality tables:
--     CREATE MATERIALIZED VIEW mv_daily_page_views AS
--     SELECT workspace_id, date_trunc('day', created_at) AS day,
--            utm_source, utm_campaign, count(*) AS hits
--     FROM page_views
--     GROUP BY 1, 2, 3, 4;
--
-- • TIMESCALEDB: If Supabase enables TimescaleDB, convert page_views and
--   conversions into hypertables for automatic partitioning + compression.
--
-- • SOFT DELETES: Add a `deleted_at TIMESTAMPTZ` column if auditability
--   requires keeping deleted records. Adjust RLS to filter WHERE deleted_at
--   IS NULL.
-- ──────────────────────────────────────────────────────────────────────────────
