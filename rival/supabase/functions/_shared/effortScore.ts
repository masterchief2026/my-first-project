// Single server-side Effort formula. Must stay in lockstep with the client
// copy in rival/src/lib/effort.ts — the same activity must score the same no
// matter which entry path (Strava sync, scan, manual) created it.

export const DEFAULT_MULTIPLIER = 0.8

export function calculateEffortScore(
  activityType: string,
  movingTimeSeconds: number,
  distanceMeters: number,
  multipliers: Record<string, number>,
): number {
  const multiplier = multipliers[activityType] ?? DEFAULT_MULTIPLIER
  const minutes = movingTimeSeconds / 60
  const km = distanceMeters / 1000
  let score = minutes * multiplier
  if (km > 5) score += (km - 5) * 0.5
  return Math.round(score * 10) / 10
}

// deno-lint-ignore no-explicit-any
export async function loadMultipliers(supabase: any): Promise<Record<string, number>> {
  const { data: configRows } = await supabase.from('scoring_config').select('activity_type, multiplier')
  const multipliers: Record<string, number> = {}
  for (const row of configRows ?? []) multipliers[row.activity_type] = Number(row.multiplier)
  return multipliers
}
