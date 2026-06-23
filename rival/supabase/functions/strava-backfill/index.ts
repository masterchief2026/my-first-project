import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calculateEffortScore(activityType: string, movingTime: number, distance: number, multipliers: Record<string, number>): number {
  const multiplier = multipliers[activityType] ?? 0.8
  const minutes = movingTime / 60
  const km = distance / 1000
  let score = minutes * multiplier
  if (km > 5) score += (km - 5) * 0.5
  return Math.round(score * 10) / 10
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

    // Refresh token if expired
    let accessToken = connection.access_token
    const expiresAt = new Date(connection.token_expires_at).getTime()
    if (Date.now() > expiresAt) {
      console.log('Token expired, refreshing...')
      const refreshRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Deno.env.get('STRAVA_CLIENT_ID'),
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
          grant_type: 'refresh_token',
          refresh_token: connection.refresh_token,
        }),
      })
      const refreshData = await refreshRes.json()
      if (refreshData.access_token) {
        accessToken = refreshData.access_token
        await supabase
          .from('fitness_connections')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token,
            token_expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
          })
          .eq('user_id', user.id)
          .eq('provider', 'strava')
      }
    }

    // Load multipliers from DB
    const { data: configRows } = await supabase.from('scoring_config').select('activity_type, multiplier')
    const multipliers: Record<string, number> = {}
    for (const row of configRows ?? []) multipliers[row.activity_type] = row.multiplier

    // Fetch last 30 activities from Strava
    const activitiesRes = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=30',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const activities = await activitiesRes.json()
    console.log('Backfill v3 - detail photo fetch enabled')
    console.log(`Fetched ${activities.length} activities`)

    if (!Array.isArray(activities)) {
      return new Response(JSON.stringify({ error: 'Strava error', details: activities }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    let saved = 0
    for (const activity of activities) {
      const effortScore = calculateEffortScore(activity.type, activity.moving_time, activity.distance, multipliers)

      console.log(`Activity ${activity.id}: name="${activity.name}"`)

      const { data: existingRow } = await supabase
        .from('activities')
        .select('name_locked')
        .eq('provider_activity_id', String(activity.id))
        .maybeSingle()

      const upsertPayload: Record<string, unknown> = {
        user_id: user.id,
        provider: 'strava',
        provider_activity_id: String(activity.id),
        activity_type: activity.type,
        distance_meters: activity.distance,
        duration_seconds: activity.moving_time,
        elevation_meters: activity.total_elevation_gain,
        started_at: activity.start_date,
        effort_score: effortScore,
        raw_effort_score: effortScore,
      }
      if (!existingRow?.name_locked) {
        upsertPayload.name = activity.name
      }

      const { error } = await supabase
        .from('activities')
        .upsert(upsertPayload, { onConflict: 'provider_activity_id', ignoreDuplicates: false })

      if (error) {
        console.log(`Upsert error for ${activity.id}:`, JSON.stringify(error))
      }

      if (!error) {
        saved++

        // Try to fetch photo for this activity — skip if one already exists
        // (total_photo_count on the list endpoint is unreliable, so we check the detail endpoint)
        try {
          const { data: existing } = await supabase
            .from('activities')
            .select('photo_url')
            .eq('provider_activity_id', String(activity.id))
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
                    .eq('provider_activity_id', String(activity.id))

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
      } else {
        console.log('Error saving activity:', JSON.stringify(error))
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
