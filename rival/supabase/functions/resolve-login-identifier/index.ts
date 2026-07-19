import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Runs BEFORE authentication (verify_jwt = false, see supabase/config.toml) so
// the sign-in screen can resolve a username to its account email — Supabase
// Auth itself only signs in by email. Never returns whether a username
// exists; the caller always falls through to the same generic sign-in error
// on failure, so this can't be used to enumerate usernames.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { identifier } = await req.json()
    if (!identifier || typeof identifier !== 'string') {
      return new Response(JSON.stringify({ email: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (identifier.includes('@')) {
      return new Response(JSON.stringify({ email: identifier }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data } = await supabase
      .from('users')
      .select('email')
      .eq('username', identifier.trim().toLowerCase())
      .maybeSingle()

    return new Response(JSON.stringify({ email: data?.email ?? null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ email: null, error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
