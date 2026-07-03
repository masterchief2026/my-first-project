import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { rawUrl } = await req.json()
    if (!rawUrl) return new Response(JSON.stringify({ error: 'rawUrl required' }), { status: 400, headers: corsHeaders })

    // ESRGAN at native 2x (2048x3072, JPEG straight out) — chosen over AuraSR for
    // cost: both bill ~$0.001/compute-second, but ESRGAN finishes in a few seconds
    // vs AuraSR's long forced-4x run. Do NOT enable `face` (GFPGAN) — it redraws
    // faces and reintroduces drift. If quality ever disappoints, revert to
    // https://fal.run/fal-ai/aura-sr with { image_url, upscale_factor: 4,
    // checkpoint: 'v2', overlapping_tiles: true } (4 is a forced literal now).
    // 45s cap: if fal hangs (queue/outage) the whole function would hit the 60s edge
    // timeout and the client would get a generic failure instead of the real reason.
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 45_000)
    let upRes: Response
    try {
      upRes = await fetch('https://fal.run/fal-ai/esrgan', {
        method: 'POST',
        headers: { 'Authorization': `Key ${Deno.env.get('FAL_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: rawUrl, scale: 2, model: 'RealESRGAN_x4plus', output_format: 'jpeg' }),
        signal: abort.signal,
      })
    } catch (e) {
      console.error('Upscaler fetch threw:', String(e))
      return new Response(
        JSON.stringify({ backgroundUrl: rawUrl, upscaleError: `Upscaler unreachable: ${String(e).slice(0, 200)}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } finally {
      clearTimeout(timer)
    }

    if (!upRes.ok) {
      // Upscale failed — return the raw URL as fallback so the client always gets
      // something, but SAY SO: silent fallback hid hours of upscaler failures (users
      // unknowingly got soft 1024x1536 raws that look blurry full-screen on phones).
      const errText = await upRes.text()
      console.error('Upscaler failed:', upRes.status, errText)
      return new Response(
        JSON.stringify({ backgroundUrl: rawUrl, upscaleError: `Upscaler ${upRes.status}: ${errText.slice(0, 300)}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const upData = await upRes.json()
    const upUrl = upData?.image?.url
    if (!upUrl) {
      console.error('Upscaler returned no image url:', JSON.stringify(upData).slice(0, 300))
      return new Response(
        JSON.stringify({ backgroundUrl: rawUrl, upscaleError: 'Upscaler returned no image url' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Hand back fal's URL directly — the 4x PNG is ~38MB, so we don't copy it into
    // storage. The client fetches it once, downscales to 2048x3072 JPEG, and works
    // with that. (Raw input files are still stored by generate-share-image.)
    return new Response(JSON.stringify({ backgroundUrl: upUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
