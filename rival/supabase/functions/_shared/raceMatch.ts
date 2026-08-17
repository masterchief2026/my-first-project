// Links an incoming Strava activity to a race on the same calendar date, so the
// Activity Journal can show a Race badge without the user re-entering anything.
//
// Caveat: this runs server-side with no reliable per-user timezone (races.race_date
// is a bare 'YYYY-MM-DD', but Strava's start_date_local IS already in the athlete's
// local time — see strava payload — so we derive the date from that rather than the
// UTC start_date). If Strava's local-time offset is ever wrong, this can be off by a
// day for an activity right at midnight; low-stakes since it only skips an auto-link.
export async function findMatchingRaceId(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  startedAtLocalIso: string,
): Promise<string | null> {
  const dateStr = startedAtLocalIso.slice(0, 10) // 'YYYY-MM-DDTHH:MM:SS...' -> 'YYYY-MM-DD'
  const { data, error } = await supabase
    .from('races')
    .select('id')
    .eq('user_id', userId)
    .eq('race_date', dateStr)
  if (error || !data || data.length !== 1) return null
  return data[0].id
}
