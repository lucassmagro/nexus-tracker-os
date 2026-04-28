-- ============================================================================
-- Migration: 00002_add_super_admin.sql
-- Description: Adds 'super_admin' role and updates RLS policies for global access.
-- ============================================================================

-- 1. Add 'super_admin' to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Update get_user_role function to be more robust (optional, but good practice)
-- (It already works, but we rely on it for the new policies)

-- 3. Update RLS Policies to bypass workspace checks for super_admins
-- We will DROP existing select/update/delete policies and recreate them with an OR condition for super_admin

-- Workspaces
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces
    FOR SELECT
    TO authenticated
    USING (id = public.get_user_workspace_id() OR public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS workspaces_update ON public.workspaces;
CREATE POLICY workspaces_update ON public.workspaces
    FOR UPDATE
    TO authenticated
    USING (
        (id = public.get_user_workspace_id() AND public.get_user_role() IN ('owner', 'admin'))
        OR public.get_user_role() = 'super_admin'
    )
    WITH CHECK (
        (id = public.get_user_workspace_id() AND public.get_user_role() IN ('owner', 'admin'))
        OR public.get_user_role() = 'super_admin'
    );

-- Users
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
    FOR SELECT
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id() OR public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
    FOR UPDATE
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id() OR public.get_user_role() = 'super_admin')
    WITH CHECK (
        public.get_user_role() = 'super_admin'
        OR (
            workspace_id = public.get_user_workspace_id()
            AND (
                public.get_user_role() IN ('owner', 'admin')
                OR auth_uid = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users
    FOR DELETE
    TO authenticated
    USING (
        public.get_user_role() = 'super_admin'
        OR (workspace_id = public.get_user_workspace_id() AND public.get_user_role() = 'owner')
    );

-- Page Views
DROP POLICY IF EXISTS page_views_select ON public.page_views;
CREATE POLICY page_views_select ON public.page_views
    FOR SELECT
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id() OR public.get_user_role() = 'super_admin');

-- Conversions
DROP POLICY IF EXISTS conversions_select ON public.conversions;
CREATE POLICY conversions_select ON public.conversions
    FOR SELECT
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id() OR public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS conversions_update ON public.conversions;
CREATE POLICY conversions_update ON public.conversions
    FOR UPDATE
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id() OR public.get_user_role() = 'super_admin')
    WITH CHECK (
        public.get_user_role() = 'super_admin'
        OR (workspace_id = public.get_user_workspace_id() AND public.get_user_role() IN ('owner', 'admin'))
    );

-- Ad Spend
DROP POLICY IF EXISTS ad_spend_select ON public.ad_spend;
CREATE POLICY ad_spend_select ON public.ad_spend
    FOR SELECT
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id() OR public.get_user_role() = 'super_admin');

DROP POLICY IF EXISTS ad_spend_update ON public.ad_spend;
CREATE POLICY ad_spend_update ON public.ad_spend
    FOR UPDATE
    TO authenticated
    USING (workspace_id = public.get_user_workspace_id() OR public.get_user_role() = 'super_admin')
    WITH CHECK (
        public.get_user_role() = 'super_admin'
        OR (workspace_id = public.get_user_workspace_id() AND public.get_user_role() IN ('owner', 'admin'))
    );

DROP POLICY IF EXISTS ad_spend_delete ON public.ad_spend;
CREATE POLICY ad_spend_delete ON public.ad_spend
    FOR DELETE
    TO authenticated
    USING (
        public.get_user_role() = 'super_admin'
        OR (workspace_id = public.get_user_workspace_id() AND public.get_user_role() = 'owner')
    );
