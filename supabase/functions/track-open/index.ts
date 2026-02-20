// Supabase Edge Function: track-open
// Records email open events and returns a 1x1 transparent GIF
// Deploy with: npx supabase functions deploy track-open

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 1x1 transparent GIF (base64-decoded bytes)
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF,
  0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3B,
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Always return the pixel regardless of what happens below
  // (Don't let tracking errors affect email rendering)
  const pixelResponse = () => new Response(TRANSPARENT_GIF, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) return pixelResponse();

    // Decode token: base64(userId:interactionId:contactId)
    let decoded: string;
    try {
      decoded = atob(token);
    } catch {
      return pixelResponse();
    }

    const parts = decoded.split(':');
    if (parts.length < 3) return pixelResponse();

    const [userId, interactionId, contactId] = parts;

    if (!userId || !interactionId || !contactId) return pixelResponse();

    // Initialize Supabase client with service role (bypasses RLS for inserts)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Hash the IP for privacy (don't store raw IP)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const ipHash = ip ? await hashString(ip) : null;
    const userAgent = req.headers.get('user-agent')?.substring(0, 200) || null;

    // Insert tracking event (ignore duplicate opens from same interaction)
    const { error } = await supabase.from('email_tracking').insert({
      user_id: userId,
      interaction_id: interactionId,
      contact_id: contactId,
      opened_at: new Date().toISOString(),
      ip_hash: ipHash,
      user_agent: userAgent,
    });

    if (error) {
      // Log but don't fail — return the pixel anyway
      console.error('Tracking insert error:', error.message);
    } else {
      // Also update the template open_count if we can determine the template
      // (Best-effort: interaction ID may encode template info in future)
      console.log(`Email opened: interaction=${interactionId}, contact=${contactId}`);
    }
  } catch (err) {
    // Silently swallow all errors — tracking should never break email rendering
    console.error('Track-open error:', err);
  }

  return pixelResponse();
});

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}
