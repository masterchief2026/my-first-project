import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const url = new URL(req.url)
    const type = url.searchParams.get('type') ?? 'monthly' // 'monthly' or 'yearly'

    const now = new Date()
    let start: Date, end: Date, label: string

    if (type === 'yearly') {
      const year = now.getFullYear()
      start = new Date(`${year}-01-01T00:00:00Z`)
      end = new Date(`${year}-12-31T23:59:59Z`)
      label = `${year} Christmas Wrap Up`
    } else {
      // Previous month
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1))
      end = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59))
      const monthName = d.toLocaleString('en-US', { month: 'long' })
      label = `${monthName} ${d.getFullYear()} Recap`
    }

    const { data: activities } = await supabase
      .from('activities')
      .select('activity_type, duration_seconds, distance_meters, elevation_meters, effort_score, started_at')
      .eq('user_id', user.id)
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString())

    const acts = activities || []
    const totalWorkouts = acts.length
    const totalMinutes = Math.round(acts.reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60)
    const totalHours = Math.floor(totalMinutes / 60)
    const remainingMins = totalMinutes % 60
    const totalDistanceKm = Math.round(acts.reduce((s, a) => s + (a.distance_meters || 0), 0) / 1000 * 10) / 10
    const totalElevation = Math.round(acts.reduce((s, a) => s + (a.elevation_meters || 0), 0))
    const totalEffort = Math.round(acts.reduce((s, a) => s + (a.effort_score || 0), 0) * 10) / 10

    // Most common activity type
    const typeCounts: Record<string, number> = {}
    acts.forEach(a => { typeCounts[a.activity_type] = (typeCounts[a.activity_type] || 0) + 1 })
    const topSport = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    // Best week (for yearly recap)
    let bestWeekLabel: string | null = null
    let bestWeekEffort = 0
    if (type === 'yearly') {
      const weekMap: Record<string, number> = {}
      acts.forEach(a => {
        const d = new Date(a.started_at)
        const day = d.getDay()
        const diff = day === 0 ? -6 : 1 - day
        const monday = new Date(d)
        monday.setDate(d.getDate() + diff)
        monday.setHours(0, 0, 0, 0)
        const key = monday.toISOString().split('T')[0]
        weekMap[key] = (weekMap[key] || 0) + (a.effort_score || 0)
      })
      const best = Object.entries(weekMap).sort((a, b) => b[1] - a[1])[0]
      if (best) {
        bestWeekEffort = Math.round(best[1] * 10) / 10
        const d = new Date(best[0])
        bestWeekLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
    }

    // Comparison with previous period (monthly only)
    let prevTotalWorkouts: number | null = null
    let prevTotalMinutes: number | null = null
    if (type === 'monthly') {
      const d2 = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const prevStart = new Date(Date.UTC(d2.getFullYear(), d2.getMonth(), 1))
      const prevEnd = new Date(Date.UTC(d2.getFullYear(), d2.getMonth() + 1, 0, 23, 59, 59))
      const { data: prevActs } = await supabase
        .from('activities')
        .select('duration_seconds')
        .eq('user_id', user.id)
        .gte('started_at', prevStart.toISOString())
        .lte('started_at', prevEnd.toISOString())
      prevTotalWorkouts = (prevActs || []).length
      prevTotalMinutes = Math.round((prevActs || []).reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60)
    }

    const recap = {
      type,
      label,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      total_workouts: totalWorkouts,
      total_hours: totalHours,
      total_minutes_remainder: remainingMins,
      total_distance_km: totalDistanceKm,
      total_elevation_m: totalElevation,
      total_effort: totalEffort,
      top_sport: topSport,
      best_week_label: bestWeekLabel,
      best_week_effort: bestWeekEffort,
      prev_total_workouts: prevTotalWorkouts,
      prev_total_minutes: prevTotalMinutes,
    }

    return new Response(JSON.stringify(recap), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
