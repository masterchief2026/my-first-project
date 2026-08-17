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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get user's Strava connection
    const { data: connection } = await supabase
      .from('fitness_connections')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .single()

    if (!connection) {
      return new Response(JSON.stringify({ error: 'No Strava connection found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const tokenResult = await getFreshStravaToken(supabase, connection, user.id)
    if ('error' in tokenResult) {
      return new Response(JSON.stringify({ error: tokenResult.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }
    const accessToken = tokenResult.token

    // Keep athlete name fresh for the "Connected to X's Strava" label
    try {
      const athleteRes = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (athleteRes.ok) {
        const athlete = await athleteRes.json()
        await supabase
          .from('fitness_connections')
          .update({ athlete_firstname: athlete.firstname ?? null, athlete_lastname: athlete.lastname ?? null })
          .eq('user_id', user.id)
          .eq('provider', 'strava')
      }
    } catch (athleteErr) {
      console.log('Athlete fetch failed:', athleteErr.message)
    }

    const multipliers = await loadMultipliers(supabase)

    // Fetch last 30 activities from Strava
    const activitiesRes = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=30',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const activities = await activitiesRes.json()
    console.log('Backfill v3 - detail photo fetch enabled')

    if (!activitiesRes.ok || !Array.isArray(activities)) {
      const status = activitiesRes.status === 401 ? 401 : 400
      const error = status === 401 ? 'Strava authorization expired — please reconnect Strava' : 'Strava error'
      return new Response(JSON.stringify({ error, details: activities }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      })
    }
    console.log(`Fetched ${activities.length} activities`)

    let saved = 0
    for (const activity of activities) {
      const effortScore = calculateEffortScore(activity.type, activity.moving_time, activity.distance, multipliers)

      console.log(`Activity ${activity.id}: name="${activity.name}"`)

      const providerActivityId = String(activity.id)
      // external_id reveals the ORIGINAL source of a Strava activity (e.g.
      // "garmin_ping_123.fit" from a Garmin watch) — kept on activity_sources so
      // a future direct Garmin/Health integration can match exactly, not fuzzily.
      const sourceProvenance = {
        external_id: activity.external_id ?? null,
        upload_id: activity.upload_id ?? null,
      }

      // Resolves same-source re-syncs AND cross-source duplicates to one canonical
      // activities row — every importer must go through this, never a bespoke
      // upsert keyed on provider_activity_id (see _shared/activityDedup.ts).
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
        started_at: activity.start_date,
        effort_score: effortScore,
        raw_effort_score: effortScore,
        route_polyline: activity.map?.summary_polyline || null,
        // start_date_local (not start_date) — races.race_date is a bare calendar
        // date, so matching needs the athlete's local day, not the UTC one.
        race_id: await findMatchingRaceId(supabase, user.id, activity.start_date_local),
      }

      let activityId: string | null = null
      if (canonicalId) {
        // Only touch `name` when Strava itself is the row's origin and it isn't
        // locked — a cross-source match shouldn't let a Strava sync clobber a
        // name set by whichever source created the row.
        const { data: existingRow } = await supabase
          .from('activities')
          .select('name_locked, provider')
          .eq('id', canonicalId)
          .maybeSingle()
        const updateFields: Record<string, unknown> = { ...fields }
        if (existingRow?.provider === 'strava' && !existingRow?.name_locked) updateFields.name = activity.name

        const { error } = await supabase.from('activities').update(updateFields).eq('id', canonicalId)
        if (error) console.log(`Update error for ${activity.id}:`, JSON.stringify(error))
        else activityId = canonicalId
      } else {
        const { data: inserted, error } = await supabase
          .from('activities')
          .insert({ user_id: user.id, provider: 'strava', provider_activity_id: providerActivityId, name: activity.name, ...fields })
          .select('id')
          .single()
        if (error) console.log(`Insert error for ${activity.id}:`, JSON.stringify(error))
        else if (inserted) {
          await linkNewActivitySource(supabase, user.id, inserted.id, 'strava', providerActivityId, sourceProvenance)
          activityId = inserted.id
        }
      }

      if (activityId) {
        saved++

        // Try to fetch photo for this activity — skip if one already exists
        // (total_photo_count on the list endpoint is unreliable, so we check the detail endpoint)
        try {
          const { data: existing } = await supabase
            .from('activities')
            .select('photo_url')
            .eq('id', activityId)
            .single()

          if (!existing?.photo_url) {
            // Use the dedicated photos endpoint — more reliable than activity detail
            const photosRes = await fetch(
              `https://www.strava.com/api/v3/activities/${activity.id}/photos?photo_sources=true&size=1900`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
            const photos = await photosRes.json()
            console.log(`Photos for ${activity.id}:`, JSON.stringify(photos).substring(0, 300))

            const cdnUrl: string | null = Array.isArray(photos) && photos.length > 0
              ? (photos[0].urls?.['1900'] ?? photos[0].urls?.['600'] ?? photos[0].urls?.['100'] ?? null)
              : null

            if (cdnUrl) {
              // Download from Strava CDN and re-upload to Supabase Storage
              // (Strava CDN URLs expire — storing in Supabase keeps them permanent)
              const imgRes = await fetch(cdnUrl)
              if (imgRes.ok) {
                const imgBytes = await imgRes.arrayBuffer()
                const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
                const ext = contentType.includes('png') ? 'png' : 'jpg'
                const storagePath = `strava/${user.id}/${activity.id}.${ext}`

                const { error: storageErr } = await supabase.storage
                  .from('activity-photos')
                  .upload(storagePath, imgBytes, { contentType, upsert: true })

                if (!storageErr) {
                  const { data: urlData } = supabase.storage
                    .from('activity-photos')
                    .getPublicUrl(storagePath)

                  await supabase
                    .from('activities')
                    .update({ photo_url: urlData.publicUrl })
                    .eq('id', activityId)

                  console.log(`Photo saved for activity ${activity.id}`)
                } else {
                  console.log(`Storage error for ${activity.id}:`, storageErr.message)
                }
              }
            }
          }
        } catch (photoErr) {
          console.log(`Photo fetch failed for activity ${activity.id}:`, photoErr.message)
        }
      }
    }

    return new Response(JSON.stringify({ success: true, saved, total: activities.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.log('Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
