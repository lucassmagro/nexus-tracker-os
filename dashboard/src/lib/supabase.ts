/**
 * Supabase Client — Server-Side (RSC)
 * ─────────────────────────────────────
 * Used by async Server Components to fetch data from Supabase.
 * Uses the service_role key for full access (server-only).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
