import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-domain.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Single shared client for the whole app. The anon key is safe to expose —
// row-level security in schema.sql is what actually protects your data.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
