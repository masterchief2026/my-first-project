import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Ricky's own account — exempt from the regen cooldown so he can iterate on
// crest quality/prompt changes without waiting 6 months between tries. Every
// other account still gets the real limit.
const UNLIMITED_REGEN_USER_ID = '09b2e197-8257-4d7c-a0e6-12dc0429eeff'

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
    if (league.crest_generated_at && user.id !== UNLIMITED_REGEN_USER_ID) {
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

    // The team name text is the single most important element — flux/schnell
    // sometimes drops baked-in text entirely, so this is stated up front and
    // repeated at the end rather than mentioned once in the middle, and
    // "MUST" language is used deliberately (soft phrasing like "bold clean
    // title text" got skipped more often in practice).
    const prompt = `A sports/fitness team crest that MUST include the team's name "${league.name}" as bold, legible text on a title banner across the bottom of the badge — this text is the most important part of the image and must not be omitted. Emblem crest badge logo, concept: ${concept}. Vector illustration style, layered papercut scene, badge/shield border, symmetrical, high detail, no photorealism, plain flat light background so the badge silhouette is easy to cut out. Remember: the banner text "${league.name}" must be clearly rendered and readable.`

    // fal-ai/flux/schnell — cheap, fast text-to-image (~$0.003/image), chosen
    // over the higher-quality GPT Image model specifically for per-team cost.
    // Generating 3 in one call gives the admin a real choice instead of a
    // single take-it-or-leave-it result.
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 45_000)
    let genRes: Response
    try {
      genRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': `Key ${Deno.env.get('FAL_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image_size: 'square_hd', num_images: 3 }),
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
    const rawImageUrls: string[] = (genData?.images ?? []).map((img: any) => img?.url).filter(Boolean)
    if (rawImageUrls.length === 0) {
      console.error('Crest gen returned no image urls:', JSON.stringify(genData).slice(0, 300))
      return new Response(JSON.stringify({ error: 'Crest generator returned no images' }), { status: 502, headers: corsHeaders })
    }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    // Cut the flat generator background out of each candidate so the crest
    // displays on its own, e.g. sitting directly on the app's dark UI instead
    // of a visible box. Best-effort per image: if bg removal fails for one,
    // that candidate ships opaque rather than dropping it from the set.
    const candidateUrls = await Promise.all(rawImageUrls.map(async (imageUrl, i) => {
      let finalUrl = imageUrl
      try {
        const rembgRes = await fetch('https://fal.run/fal-ai/imageutils/rembg', {
          method: 'POST',
          headers: { 'Authorization': `Key ${Deno.env.get('FAL_KEY')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl }),
        })
        if (rembgRes.ok) {
          const rembgData = await rembgRes.json()
          const cutoutUrl = rembgData?.image?.url
          if (cutoutUrl) finalUrl = cutoutUrl
        } else {
          console.error('Bg removal failed:', rembgRes.status, await rembgRes.text())
        }
      } catch (e) {
        console.error('Bg removal unreachable:', String(e).slice(0, 200))
      }

      const imgRes = await fetch(finalUrl)
      const imgBytes = new Uint8Array(await imgRes.arrayBuffer())
      const path = `leagues/${leagueId}/crest-candidate-${i}.png`
      const { error: storageErr } = await adminClient.storage
        .from('avatars')
        .upload(path, imgBytes, { contentType: 'image/png', upsert: true })
      if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`)

      // The upload path is stable across regenerations (upsert to the same
      // filename), so the public URL never changes on its own — browsers/CDN
      // would keep serving a previous candidate's bytes indefinitely. A
      // cache-busting query param forces every batch to be fetched fresh.
      const { data: urlData } = adminClient.storage.from('avatars').getPublicUrl(path)
      return `${urlData.publicUrl}?v=${Date.now()}-${i}`
    }))

    // Deliberately not writing logo_url/crest_generated_at here — the admin
    // hasn't chosen one yet. The cooldown starts only once a pick is
    // confirmed (client writes those two columns directly; RLS's "admins can
    // update league" policy already gates that write to the same admins this
    // function just checked).
    return new Response(JSON.stringify({ urls: candidateUrls }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
