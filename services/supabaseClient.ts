// FIX: Moved triple-slash directive to the top of the file. This is required for TypeScript to correctly process it and resolve Vite's client types for `import.meta.env`.
/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js'

// For a client-side app built with Vite, environment variables must be
// accessed via `import.meta.env` and must be prefixed with `VITE_`.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided in your Netlify settings.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
