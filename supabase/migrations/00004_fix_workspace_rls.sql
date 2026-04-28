-- ============================================================================
-- Migration: 00004_fix_workspace_rls.sql
-- Description: Fix workspaces RLS policies for creation flow
-- ============================================================================

-- Drop the restrictive select policy
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;

-- Allow users to select workspaces they are linked to, OR if they are a super_admin, 
-- OR we can just allow authenticated users to view workspaces since they have unpredictable IDs, 
-- but the user requested: "Rewrite the 'INSERT' and 'SELECT' policies for the 'workspaces' table to: Allow any authenticated user to INSERT a new workspace."
CREATE POLICY workspaces_select ON public.workspaces
    FOR SELECT
    TO authenticated
    USING (
        id = public.get_user_workspace_id() 
        OR public.get_user_role() = 'super_admin'
        -- We add a condition to allow users who have NO workspace yet to select the workspace they just inserted. 
        -- This is a bit tricky with RLS, so another approach is to allow all authenticated users to select from workspaces, 
        -- but that leaks workspace IDs. A better approach is to let users select if they just created it.
        -- But wait, if they have NO workspace in the users table, get_user_workspace_id() returns NULL.
        -- Actually, the user asked to change the policies to avoid the error. The easiest way is to use the service_role key correctly or allow insert.
    );

-- The actual fix for "new row violates row-level security policy for table workspaces" on INSERT
-- is adding an INSERT policy! The previous schema didn't have an INSERT policy for workspaces at all, 
-- assuming super_admin or service_role would do it.
DROP POLICY IF EXISTS workspaces_insert ON public.workspaces;
CREATE POLICY workspaces_insert ON public.workspaces
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- We will also slightly adjust the select policy so they can select the workspace they just created
-- before they are linked in the users table. One way is to check if they have NO workspace yet.
CREATE OR REPLACE FUNCTION public.user_has_no_workspace()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM public.users WHERE auth_uid = auth.uid() AND workspace_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces
    FOR SELECT
    TO authenticated
    USING (
        id = public.get_user_workspace_id() 
        OR public.get_user_role() = 'super_admin'
        OR public.user_has_no_workspace()
    );
