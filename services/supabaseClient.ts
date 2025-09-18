
import { createClient } from '@supabase/supabase-js'

// FIX: Use process.env to resolve TypeScript error "Property 'env' does not exist on type 'ImportMeta'".
const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided in your Netlify settings.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
