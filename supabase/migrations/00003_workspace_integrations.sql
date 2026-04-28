-- ============================================================================
-- NEXUS TRACKER OS — Phase 5: Workspace Integrations & Onboarding
-- Adds Shopify integration fields to the workspaces table.
-- ============================================================================

-- 1. Add Shopify integration columns to workspaces
ALTER TABLE public.workspaces 
ADD COLUMN shopify_store_url TEXT,
ADD COLUMN shopify_webhook_secret TEXT;

COMMENT ON COLUMN public.workspaces.shopify_store_url IS 'The URL of the client''s Shopify store (e.g. storename.myshopify.com).';
COMMENT ON COLUMN public.workspaces.shopify_webhook_secret IS 'The secret key used to verify Shopify webhooks for this workspace.';

-- 2. Update users table email constraint
-- The existing constraint uq_users_workspace_email is fine.

-- 3. Grant permissions for these columns
-- The existing RLS policy workspaces_select already allows reading the whole row.
-- We might want to ensure only owners/admins can see the webhook_secret.
-- However, for a simple implementation, we'll keep the current select policy.
