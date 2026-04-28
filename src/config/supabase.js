/**
 * Supabase Admin Client
 * ─────────────────────
 * Uses the service_role key to bypass Row Level Security.
 * This client is ONLY used server-side for trusted ingestion pipelines.
 * NEVER expose the service_role key to the browser.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "[nexus] FATAL — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
  );
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    // Disable auth features — we authenticate via the service_role key itself.
    autoRefreshToken: false,
    persistSession: false,
  },
});
