// Single Strava token-refresh path. The three importers each had their own
// copy and they had already drifted: the webhook version silently fell through
// with a stale token when the refresh failed (sync died forever with no
// signal). Callers decide how to respond to failure (webhook acks + skips,
// user-facing functions return "reconnect Strava"), but the refresh/persist
// logic lives only here.

export type StravaConnection = {
  access_token: string
  refresh_token: string
  token_expires_at: string
}

export async function getFreshStravaToken(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  connection: StravaConnection,
  userId: string,
): Promise<{ token: string } | { error: string }> {
  if (Date.now() <= new Date(connection.token_expires_at).getTime()) {
    return { token: connection.access_token }
  }

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
  if (!refreshRes.ok || !refreshData.access_token) {
    console.log('Strava token refresh failed for user', userId, JSON.stringify(refreshData).slice(0, 300))
    return { error: 'Strava token refresh failed — please reconnect Strava' }
  }

  await supabase
    .from('fitness_connections')
    .update({
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token,
      token_expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava')

  return { token: refreshData.access_token }
}
