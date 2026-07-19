import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveCanonicalActivityId, linkNewActivitySource } from '../_shared/activityDedup.ts'
import { calculateEffortScore, loadMultipliers } from '../_shared/effortScore.ts'
import { getFreshStravaToken } from '../_shared/stravaAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Strava webhook verification (GET request)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const verifyToken = Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN')

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified')
      return new Response(
        JSON.stringify({ 'hub.challenge': challenge }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response('Forbidden', { status: 403 })
  }

  // Handle incoming webhook event (POST)
  if (req.method === 'POST') {
    const event = await req.json()
    console.log('Webhook event:', JSON.stringify(event))

    // Only process activity creates/updates
    if (event.object_type !== 'activity' || !['create', 'update'].includes(event.aspect_type)) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const stravaAthleteId = String(event.owner_id)
    const stravaActivityId = String(event.object_id)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Find the user by strava athlete ID
    const { data: connection, error: connError } = await supabase
      .from('fitness_connections')
      .select('user_id, access_token, refresh_token, token_expires_at')
      .eq('provider', 'strava')
      .eq('provider_user_id', stravaAthleteId)
      .single()

    if (connError || !connection) {
      console.log('No connection found for athlete:', stravaAthleteId)
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const tokenResult = await getFreshStravaToken(supabase, connection, connection.user_id)
    if ('error' in tokenResult) {
      // Do NOT fall through with the stale token — every event would 401 at
      // the activity fetch and sync would die silently, forever. Ack the
      // webhook (Strava retries/disables the subscription on non-2xx) but
      // skip the event; the user's next manual sync/import will tell them to
      // reconnect Strava.
      console.log('Token refresh FAILED for user', connection.user_id, '— skipping event. User must reconnect Strava.')
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    const accessToken = tokenResult.token

    const multipliers = await loadMultipliers(supabase)

    // Fetch activity details from Strava
    const activityRes = await fetch(
      `https://www.strava.com/api/v3/activities/${stravaActivityId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const activity = await activityRes.json()
    console.log('Activity type:', activity.type, 'Duration:', activity.moving_time)

    const effortScore = calculateEffortScore(activity.type, activity.moving_time, activity.distance, multipliers)
    console.log('Effort score:', effortScore)

    // Resolves same-source re-syncs AND cross-source duplicates (e.g. a Garmin watch
    // that also auto-exports to Strava) to one canonical activities row — see
    // supabase/functions/_shared/activityDedup.ts.
    // external_id/device_name reveal the ORIGINAL source of a Strava activity
    // (e.g. "garmin_ping_123.fit" from a Garmin watch) — kept on activity_sources
    // so a future direct Garmin/Health integration can match exactly, not fuzzily.
    const sourceProvenance = {
      external_id: activity.external_id ?? null,
      upload_id: activity.upload_id ?? null,
      device_name: activity.device_name ?? null,
    }

    const canonicalId = await resolveCanonicalActivityId(supabase, {
      userId: connection.user_id,
      provider: 'strava',
      providerActivityId: stravaActivityId,
      activityType: activity.type,
      startedAt: activity.start_date,
      durationSeconds: activity.moving_time,
      distanceMeters: activity.distance,
      rawPayload: sourceProvenance,
    })

    const fields = {
      activity_type: activity.type,
      distance_meters: activity.distance,
      duration_seconds: activity.moving_time,
      elevation_meters: activity.total_elevation_gain,
      started_at: activity.start_date,
      effort_score: effortScore,
      raw_effort_score: effortScore,
      route_polyline: activity.map?.summary_polyline || null,
    }

    if (canonicalId) {
      const { data: existingRow } = await supabase
        .from('activities')
        .select('name_locked, provider')
        .eq('id', canonicalId)
        .maybeSingle()
      const updateFields: Record<string, unknown> = { ...fields }
      if (existingRow?.provider === 'strava' && !existingRow?.name_locked) updateFields.name = activity.name

      const { error: activityError } = await supabase.from('activities').update(updateFields).eq('id', canonicalId)
      if (activityError) console.log('Activity update error:', JSON.stringify(activityError))
      else console.log('Activity saved successfully with effort score:', effortScore)
    } else {
      const { data: inserted, error: activityError } = await supabase
        .from('activities')
        .insert({ user_id: connection.user_id, provider: 'strava', provider_activity_id: stravaActivityId, name: activity.name, ...fields })
        .select('id')
        .single()
      if (activityError) {
        console.log('Activity insert error:', JSON.stringify(activityError))
      } else {
        if (inserted) await linkNewActivitySource(supabase, connection.user_id, inserted.id, 'strava', stravaActivityId, sourceProvenance)
        console.log('Activity saved successfully with effort score:', effortScore)
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  return new Response('Method not allowed', { status: 405 })
})
