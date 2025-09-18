import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// This configuration bridges the gap between client-side code and environment variables.
// Vite's `define` property performs a global text replacement at build time.
// This allows us to use `process.env.VAR_NAME` in the source code, which is then
// replaced by the actual value from your Netlify environment variables.
export default defineConfig(({ mode }) => {
  // Load all environment variables from the current environment (e.g., Netlify build)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      // Replaces `process.env.API_KEY` in the code with the value of `VITE_GEMINI_API_KEY`
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      // Replaces `process.env.SUPABASE_URL` with the value of `VITE_SUPABASE_URL`
      'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      // Replaces `process.env.SUPABASE_ANON_KEY` with the value of `VITE_SUPABASE_ANON_KEY`
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            recharts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
          }
        }
      }
    },
    server: {
      port: 3000
    },
    preview: {
      port: 3000
    }
  };
});
