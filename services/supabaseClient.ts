import { createClient } from '@supabase/supabase-js'

// At build time, Vite replaces `process.env.VAR_NAME` with the actual value
// of the corresponding `VITE_...` environment variable from your Netlify settings.
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided in your Netlify settings.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
