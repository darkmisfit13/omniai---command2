import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy, server-only admin client. Returns null in non-configured environments
// so routes can degrade instead of crashing at import/build time.
let cached: SupabaseClient | null = null;
export const supabaseAdmin: SupabaseClient | null =
  supabaseUrl && supabaseServiceKey
    ? (cached ??= createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }))
    : null;

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && supabaseServiceKey);
export default supabaseAdmin;
