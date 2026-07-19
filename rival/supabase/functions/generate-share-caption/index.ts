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

    const { activityType, distanceKm, durationMin, elevationM, pace, isPb, effortScore } = await req.json()

    const prompt = `You write punchy, motivating one-liners for fitness social media posts. No hashtags. No emojis in the line itself. Maximum 12 words. Make it feel earned, not generic.

Workout:
- Type: ${activityType || 'workout'}
${distanceKm ? `- Distance: ${distanceKm} km` : ''}
${durationMin ? `- Duration: ${durationMin} min` : ''}
${elevationM ? `- Elevation: ${elevationM} m` : ''}
${pace ? `- Pace: ${pace}` : ''}
${isPb ? '- This was a personal best' : ''}
${effortScore ? `- Effort score: ${effortScore}` : ''}

Write exactly one short caption line. No punctuation at the end unless it's genuinely impactful. Do not use "grind", "hustle", "beast mode" or other clichés.`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const anthropicData = await anthropicRes.json()
    const caption = anthropicData.content?.[0]?.text?.trim() ?? null

    return new Response(JSON.stringify({ caption }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
