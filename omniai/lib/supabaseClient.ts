import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single shared client for the whole app. The anon key is safe to expose —
// row-level security in schema.sql is what actually protects your data.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
