import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendPushMessages } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const type = url.searchParams.get('type') ?? 'monthly'

  const authHeader = req.headers.get('Authorization')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

  const { data: tokens } = await supabase.from('push_tokens').select('user_id, token')

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  const isYearly = type === 'yearly'
  const now = new Date()
  const monthName = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleString('en-US', { month: 'long' })

  const messages = tokens.map((t: any) => ({
    to: t.token,
    title: isYearly ? `🎄 Your Christmas Wrap Up is here` : `📊 Your ${monthName} Recap is ready`,
    body: isYearly
      ? `A whole year of Effort. See how far you've come — your ${now.getFullYear()} story is waiting.`
      : `See what you built last month — hours, Effort, highlights. Your recap is ready.`,
    data: { screen: 'recap', type },
    sound: 'default',
  }))

  const pushResult = await sendPushMessages(messages)

  return new Response(JSON.stringify(pushResult), {
    status: 200, headers: corsHeaders,
  })
})
