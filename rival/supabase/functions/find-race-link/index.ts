import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Saves the "open a new tab, google it, copy the link back" round trip when
// adding an event — one cheap web-search-backed lookup for the official
// registration page. Haiku only supports the basic web_search_20250305
// variant (dynamic filtering needs Opus/Sonnet-tier), which is fine here:
// one search, no follow-up reasoning needed.
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

    const { name, location } = await req.json()
    if (!name || !String(name).trim()) {
      return new Response(JSON.stringify({ error: 'Event name required' }), { status: 400, headers: corsHeaders })
    }

    const query = location ? `${name} ${location}` : name
    const todayIso = new Date().toISOString().slice(0, 10)

    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 20_000)
    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 2500,
          // Low, not zero — this call already leans on web_search for
          // grounding, so temperature is only smoothing the final pick
          // between near-tied candidates, not exploring. Left at the
          // default (near 1) the same query flip-flopped between the real
          // ironman.com listing and an unaffiliated same-name local race.
          temperature: 0.2,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
          messages: [{
            role: 'user',
            // Broadened from "registration page" — plenty of things get added
            // here that aren't a formal public race (a gym, a club, a regular
            // meetup spot). Returns up to 3 candidates instead of committing
            // to one — ambiguous names (two clubs, last year's vs this year's
            // event page) get resolved by the user, not silently by the model.
            content: `Today's date is ${todayIso}. Find up to 3 candidate websites for "${query}". This could be a race/event, a gym, a club, or a venue.

Priority #1, above everything else: the URL must come from the event/organization itself — its own domain (e.g. ironman.com for an Ironman race), or a known race-registration platform it uses (e.g. RunSignUp, Active.com) — never a tourism board, city guide, travel blog, Facebook page, or generic SEO aggregator, even if those rank higher in search or have more extractable details. If you can't find the exact event's own page, a same-organization page (e.g. the race series' general site or events listing) is still a good result — prefer that over returning nothing. Only leave a candidate out entirely if you truly can't find anything from the organization itself.

Watch for name collisions with well-known trademarked race series (IRONMAN, Spartan, Tough Mudder, Rock 'n' Roll, etc.): an unaffiliated local race can legally use generic words from a famous name (e.g. a small community "Iron Man" triathlon hosted on a registration platform, unrelated to the WTC-owned IRONMAN series) and rank just as highly in search as the real thing. A registration-platform URL (RunSignUp, Active.com) with a name that merely resembles a trademarked series is NOT automatically that series — verify the organizer, don't pattern-match on the name alone. When the query plausibly refers to a famous series, the series' own domain (ironman.com, spartan.com, etc.) is strong evidence of being the real one; a platform-hosted page with a similar but not exact name is weaker evidence and belongs alongside it as a separate candidate, not in place of it.

For each candidate, "label" (org/event name) and "url" are required — the url itself must satisfy Priority #1 above. These are optional extras — omit any you're not confident in, never guess. Unlike the url, they do NOT need to come from that same official page: if the organization's own site is inaccessible or doesn't state them, pulling a confidently-correct value from a secondary source (a running calendar site, Wikipedia, a press article) is fine — a user manually re-typing a date you could have found defeats the point of this search. For your top candidate specifically, if its own page didn't give you the date, spend one more search on something like "<event name> <year> date" before giving up on it — don't stop at the first page that didn't have it. Don't let hunting for these slow down or distract from finding the right URL first.
- "location": city/region
- "date": event date as YYYY-MM-DD, for the NEXT UPCOMING edition of the event relative to today's date given above — never a past edition. Annual events get re-run every year with a new date each time, and search results (especially secondary sources) mix pages from multiple years — a page or snippet mentioning last year's date is not evidence for this year's, don't reuse it. If the event spans multiple days (e.g. a race weekend with an expo, or multiple distances on different days), use the single main race day, not the first day of activities — still omit if the upcoming date isn't confidently known
- "type": one of exactly Run, Ride, Swim, Triathlon, HYROX, CrossFit, Other (omit if not a race, e.g. a gym)
- "distance_km": total race distance in km, for Run/Ride/Swim/Other only
- "triathlon_km": {"swim":number,"bike":number,"run":number} leg distances in km, Triathlon only

Reply with ONLY raw JSON, no markdown or commentary: {"candidates":[{"label":"...","url":"..."}]} with optional fields added where known. If nothing found with reasonable confidence, reply with {"candidates":[]}.`,
          }],
        }),
        signal: abort.signal,
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: `Search unreachable: ${String(e).slice(0, 200)}` }), { status: 502, headers: corsHeaders })
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      const errText = await res.text()
      console.error('find-race-link failed:', res.status, errText)
      return new Response(JSON.stringify({ error: `Search ${res.status}: ${errText.slice(0, 300)}` }), { status: 502, headers: corsHeaders })
    }

    const data = await res.json()
    if (data?.stop_reason === 'max_tokens') {
      console.error('find-race-link: response truncated at max_tokens for query:', query)
    }
    const textBlocks = (data?.content ?? []).filter((b: any) => b.type === 'text')
    const answer = textBlocks[textBlocks.length - 1]?.text?.trim() ?? ''

    // Defensive extraction — Haiku occasionally wraps JSON in a code fence or
    // adds a stray sentence despite the "raw JSON only" instruction.
    const jsonMatch = answer.match(/\{[\s\S]*\}/)
    const VALID_TYPES = ['Run', 'Ride', 'Swim', 'Triathlon', 'HYROX', 'CrossFit', 'Other']
    type Candidate = {
      label: string; url: string; location?: string; date?: string; type?: string;
      distance_km?: number; triathlon_km?: { swim: number; bike: number; run: number };
    }
    let candidates: Candidate[] = []
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        candidates = (parsed?.candidates ?? [])
          .filter((c: any) => c && typeof c.url === 'string' && /^https?:\/\//.test(c.url))
          .map((c: any): Candidate => ({
            label: String(c.label ?? c.url).slice(0, 80),
            url: c.url,
            ...(typeof c.location === 'string' && c.location.trim() ? { location: c.location.trim().slice(0, 80) } : {}),
            // Belt-and-braces on top of the prompt instruction: a stale date
            // from a mismatched year is worse than none, since the caller
            // treats a present "date" as confidently correct.
            ...(typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.date >= todayIso ? { date: c.date } : {}),
            ...(typeof c.type === 'string' && VALID_TYPES.includes(c.type) ? { type: c.type } : {}),
            ...(typeof c.distance_km === 'number' && c.distance_km > 0 ? { distance_km: c.distance_km } : {}),
            ...(c.triathlon_km && typeof c.triathlon_km.swim === 'number' && typeof c.triathlon_km.bike === 'number' && typeof c.triathlon_km.run === 'number'
              ? { triathlon_km: { swim: c.triathlon_km.swim, bike: c.triathlon_km.bike, run: c.triathlon_km.run } }
              : {}),
          }))
          .slice(0, 3)
      } catch {
        // Fall through with candidates = [] — treated the same as "not found".
      }
    }

    return new Response(JSON.stringify({ candidates }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
