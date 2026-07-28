// Single shared Expo push sender. Every notification function must use this —
// hand-rolled fetches were copy-pasted 8 ways and none of them chunked, and
// Expo REJECTS any batch over 100 messages, so the first big team/race would
// silently lose its entire notification batch.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const CHUNK_SIZE = 100 // hard Expo limit per request

export type PushMessage = {
  to: string
  title?: string
  body: string
  sound?: string
  data?: Record<string, unknown>
}

export async function sendPushMessages(
  messages: PushMessage[],
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = []
  let sent = 0

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE)
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      })
      const json = await res.json()
      if (!res.ok) {
        errors.push(`Expo push HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`)
        continue
      }
      sent += chunk.length
      // Expo returns per-message tickets; surface individual failures instead
      // of discarding them (DeviceNotRegistered etc. were previously invisible).
      const tickets = json?.data
      if (Array.isArray(tickets)) {
        for (const t of tickets) {
          if (t?.status === 'error') errors.push(t.details?.error ?? t.message ?? 'unknown ticket error')
        }
      }
    } catch (e) {
      errors.push(String(e))
    }
  }

  if (errors.length > 0) console.log('Push send errors:', JSON.stringify(errors.slice(0, 10)))
  return { sent, errors }
}

// Convenience: user_id → Expo token for a set of users.
export async function getTokenMap(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userIds: string[],
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('user_id, token')
    .in('user_id', userIds)
  const map: Record<string, string> = {}
  for (const t of tokens || []) map[t.user_id] = t.token
  return map
}
