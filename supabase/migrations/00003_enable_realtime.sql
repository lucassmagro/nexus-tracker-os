-- ============================================================================
-- Migration: 00003_enable_realtime.sql
-- Description: Enables Supabase Realtime broadcast for page_views and conversions
-- ============================================================================

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_views;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversions;
