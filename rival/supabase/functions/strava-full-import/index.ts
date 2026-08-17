import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveCanonicalActivityId, linkNewActivitySource } from '../_shared/activityDedup.ts'
import { findMatchingRaceId } from '../_shared/raceMatch.ts'
import { calculateEffortScore, loadMultipliers } from '../_shared/effortScore.ts'
import { getFreshStravaToken } from '../_shared/stravaAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_PAGES = 20 // 200/page → up to 4,000 historical activities per import
const HOUR_MILESTONES = [
  { type: 'hours_100', hours: 100, title: '💯 100 Hours Earned', body: "You've crossed 100 hours of training. That's not a hobby anymore." },
  { type: 'hours_500', hours: 500, title: '⚡ 500 Hours Earned', body: "500 hours. Five hundred. Most people dream it. You did it." },
  { type: 'hours_1000', hours: 1000, title: '🏆 1,000 Hours Earned', body: "A thousand hours of choosing hard over easy. You are built different." },
  { type: 'hours_5000', hours: 5000, title: '👑 5,000 Hours Earned', body: "5,000 hours. You have earned something most people will never understand." },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const { data: connection } = await supabase
      .from('fitness_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id).eq('provider', 'strava').single()

    if (!connection) {
      return new Response(JSON.stringify({ error: 'No Strava connection found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
      })
    }

    const tokenResult = await getFreshStravaToken(supabase, connection, user.id)
    if ('error' in tokenResult) {
      return new Response(JSON.stringify({ error: tokenResult.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }
    const accessToken = tokenResult.token

    const multipliers = await loadMultipliers(supabase)

    let saved = 0
    let totalFetched = 0
    let page = 1
    let rateLimited = false
    let fetchError: string | null = null

    while (page <= MAX_PAGES) {
      const activitiesRes = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?per_page=200&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!activitiesRes.ok) {
        // Don't silently treat a mid-import failure as "reached the end" —
        // Strava's API rate limit (shared across the whole app, resets every
        // 15 min) is the most likely cause if this happens partway through a
        // large history. Surface it instead of returning a false "success".
        if (activitiesRes.status === 429) rateLimited = true
        else fetchError = `Strava API error (status ${activitiesRes.status}) on page ${page}`
        break
      }
      const activities = await activitiesRes.json()
      if (!Array.isArray(activities) || activities.length === 0) break

      totalFetched += activities.length

      for (const activity of activities) {
        const effortScore = calculateEffortScore(activity.type, activity.moving_time, activity.distance, multipliers)
        const providerActivityId = String(activity.id)

        // Resolves same-source re-syncs AND cross-source duplicates (e.g. a Garmin
        // watch that also auto-exports to Strava) to one canonical activities row —
        // see supabase/functions/_shared/activityDedup.ts.
        // external_id reveals the ORIGINAL source of a Strava activity (e.g.
        // "garmin_ping_123.fit" from a Garmin watch) — kept on activity_sources so
        // a future direct Garmin/Health integration can match exactly, not fuzzily.
        // (device_name isn't present on list-endpoint summary activities.)
        const sourceProvenance = {
          external_id: activity.external_id ?? null,
          upload_id: activity.upload_id ?? null,
        }

        const canonicalId = await resolveCanonicalActivityId(supabase, {
          userId: user.id,
          provider: 'strava',
          providerActivityId,
          activityType: activity.type,
          startedAt: activity.start_date,
          durationSeconds: activity.moving_time,
          distanceMeters: activity.distance,
          rawPayload: sourceProvenance,
        })

        const fields: Record<string, unknown> = {
          activity_type: activity.type,
          distance_meters: activity.distance,
          duration_seconds: activity.moving_time,
          elevation_meters: activity.total_elevation_gain,
          route_polyline: activity.map?.summary_polyline || null,
          started_at: activity.start_date,
          effort_score: effortScore,
          raw_effort_score: effortScore,
          // start_date_local (not start_date) — races.race_date is a bare calendar
          // date, so matching needs the athlete's local day, not the UTC one.
          race_id: await findMatchingRaceId(supabase, user.id, activity.start_date_local),
        }

        if (canonicalId) {
          // Known row — update in place. Only touch `name` when Strava itself is the
          // row's origin and it isn't locked; a cross-source fuzzy match shouldn't let
          // a later Strava sync clobber a name/details set by whichever source created it.
          const { data: existingRow } = await supabase
            .from('activities')
            .select('name_locked, provider')
            .eq('id', canonicalId)
            .maybeSingle()
          if (existingRow?.provider === 'strava' && !existingRow?.name_locked) fields.name = activity.name

          const { error } = await supabase.from('activities').update(fields).eq('id', canonicalId)
          if (!error) saved++
        } else {
          const { data: inserted, error } = await supabase
            .from('activities')
            .insert({ user_id: user.id, provider: 'strava', provider_activity_id: providerActivityId, name: activity.name, ...fields })
            .select('id')
            .single()
          if (!error && inserted) {
            await linkNewActivitySource(supabase, user.id, inserted.id, 'strava', providerActivityId, sourceProvenance)
            saved++
          }
        }
      }

      if (activities.length < 200) break // last page
      page++
    }

    // Recompute lifetime totals and check for newly-unlocked milestones
    const { data: allActivities } = await supabase
      .from('activities')
      .select('duration_seconds')
      .eq('user_id', user.id)
    const totalHours = (allActivities || []).reduce((s: number, a: any) => s + (a.duration_seconds || 0), 0) / 3600

    const { data: existingMilestones } = await supabase.from('milestones').select('type').eq('user_id', user.id)
    const achieved = new Set((existingMilestones || []).map((m: any) => m.type))
    const newMilestones = HOUR_MILESTONES.filter(m => totalHours >= m.hours && !achieved.has(m.type))

    if (newMilestones.length > 0) {
      await supabase.from('milestones').insert(newMilestones.map(m => ({ user_id: user.id, type: m.type })))
    }

    // Push notification: import complete summary (+ any milestones unlocked instantly)
    const { data: tokenRow } = await supabase.from('push_tokens').select('token').eq('user_id', user.id).maybeSingle()
    if (tokenRow?.token) {
      const importedHours = Math.round(totalHours)
      const messages = [{
        to: tokenRow.token,
        title: rateLimited ? `📥 Import paused — Strava asked us to slow down` : `📥 Your training history is in`,
        body: rateLimited
          ? `Imported ${saved} activities before Strava's rate limit kicked in. Wait 15 minutes and run the import again to get the rest.`
          : `Imported ${saved} activities from Strava. Your full story — ${importedHours}h and counting — is now part of RIVAL.`,
        data: { screen: 'profile' },
        sound: 'default',
      }]
      newMilestones.forEach(m => messages.push({
        to: tokenRow.token, title: m.title, body: m.body, data: { screen: 'profile' }, sound: 'default',
      }))
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(messages),
      })
    }

    return new Response(JSON.stringify({
      saved,
      totalFetched,
      pages: page,
      newMilestones: newMilestones.map(m => m.type),
      partial: rateLimited || !!fetchError,
      partialReason: rateLimited
        ? "Strava's rate limit kicked in partway through — wait 15 minutes and run the import again to get the rest."
        : fetchError,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
