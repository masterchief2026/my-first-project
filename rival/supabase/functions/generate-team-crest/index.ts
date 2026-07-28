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

    const { leagueId } = await req.json()
    if (!leagueId) return new Response(JSON.stringify({ error: 'leagueId required' }), { status: 400, headers: corsHeaders })

    const { data: membership } = await userClient
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()
    if (membership?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only team admins can generate a crest' }), { status: 403, headers: corsHeaders })
    }

    const { data: league } = await userClient
      .from('leagues')
      .select('name, crest_generated_at')
      .eq('id', leagueId)
      .single()
    if (!league) return new Response(JSON.stringify({ error: 'Team not found' }), { status: 404, headers: corsHeaders })

    // Regeneration is allowed, but only once every 6 months — frequent
    // changes would cheapen the crest as a team identity rather than a
    // disposable cosmetic, even though the per-image cost is trivial.
    if (league.crest_generated_at) {
      const nextEligible = new Date(league.crest_generated_at)
      nextEligible.setMonth(nextEligible.getMonth() + 6)
      if (Date.now() < nextEligible.getTime()) {
        return new Response(JSON.stringify({ error: `This team can regenerate its crest starting ${nextEligible.toISOString().slice(0, 10)}` }), { status: 409, headers: corsHeaders })
      }
    }

    // Ask a cheap text model what the team name actually evokes — without
    // this, every crest converges on the same mountain/badge template because
    // the image prompt itself never varied. Same model already used for AI
    // Share captions (generate-share-caption, scan-workout), so no new secret.
    let concept = 'a mountain landscape, rust orange and olive green palette, adventurous mood'
    try {
      const briefRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 60,
          messages: [{
            role: 'user',
            content: `A sports team is called "${league.name}". In one line (under 20 words, no preamble), describe a crest concept for it: a specific icon/motif suggested by the name, a 2-3 color palette, and a mood. If the name has no obvious theme, invent something fitting a fitness/sports team.`,
          }],
        }),
      })
      if (briefRes.ok) {
        const briefData = await briefRes.json()
        const text = briefData?.content?.[0]?.text?.trim()
        if (text) concept = text
      }
    } catch {
      // Fall back to the generic concept above — a crest still generates.
    }

    const prompt = `Emblem crest badge logo for a sports/fitness team called "${league.name}". Concept: ${concept}. Vector illustration style, layered papercut scene, badge/shield border, bold clean title text reading "${league.name}" at the bottom, symmetrical, high detail, no photorealism, plain dark background.`

    // fal-ai/flux/schnell — cheap, fast text-to-image (~$0.003/image), chosen
    // over the higher-quality GPT Image model specifically for per-team cost.
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 45_000)
    let genRes: Response
    try {
      genRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': `Key ${Deno.env.get('FAL_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image_size: 'square_hd', num_images: 1 }),
        signal: abort.signal,
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: `Crest generator unreachable: ${String(e).slice(0, 200)}` }), { status: 502, headers: corsHeaders })
    } finally {
      clearTimeout(timer)
    }

    if (!genRes.ok) {
      const errText = await genRes.text()
      console.error('Crest gen failed:', genRes.status, errText)
      return new Response(JSON.stringify({ error: `Crest generator ${genRes.status}: ${errText.slice(0, 300)}` }), { status: 502, headers: corsHeaders })
    }

    const genData = await genRes.json()
    const imageUrl = genData?.images?.[0]?.url
    if (!imageUrl) {
      console.error('Crest gen returned no image url:', JSON.stringify(genData).slice(0, 300))
      return new Response(JSON.stringify({ error: 'Crest generator returned no image' }), { status: 502, headers: corsHeaders })
    }

    const imgRes = await fetch(imageUrl)
    const imgBytes = new Uint8Array(await imgRes.arrayBuffer())

    const adminClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const path = `leagues/${leagueId}/crest.png`
    const { error: storageErr } = await adminClient.storage
      .from('avatars')
      .upload(path, imgBytes, { contentType: 'image/png', upsert: true })
    if (storageErr) {
      return new Response(JSON.stringify({ error: `Storage upload failed: ${storageErr.message}` }), { status: 500, headers: corsHeaders })
    }

    const { data: urlData } = adminClient.storage.from('avatars').getPublicUrl(path)
    await adminClient.from('leagues').update({ logo_url: urlData.publicUrl, crest_generated_at: new Date().toISOString() }).eq('id', leagueId)

    return new Response(JSON.stringify({ url: urlData.publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
