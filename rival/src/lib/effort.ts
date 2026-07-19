import { supabase } from './supabase';

// The scoring_config table is the single source of truth for multipliers —
// the Strava edge functions read it on every import. Client entry paths
// (scan-workout, weekly-scan) MUST score from the same table, or the same
// workout earns different Effort depending on how it entered the app.
//
// This snapshot is only the offline/failed-fetch fallback (matches the live
// table as of 2026-07-07); the fetched values always win.
const FALLBACK_MULTIPLIERS: Record<string, number> = {
  AlpineSki: 0.9, CrossFit: 1.3, HIIT: 1.1, Hike: 0.7, Hyrox: 1.4,
  Kayaking: 0.8, NordicSki: 1.2, Ride: 1.0, Rowing: 1.1, Run: 1.2,
  StandUpPaddling: 0.7, Surfing: 0.7, Swim: 1.5, VirtualRide: 0.9,
  VirtualRun: 1.1, Walk: 0.5, WeightTraining: 0.8, Workout: 0.8, Yoga: 0.5,
};

// Same unknown-type default the edge functions use.
const DEFAULT_MULTIPLIER = 0.8;

let cached: Record<string, number> | null = null;

export async function loadScoringMultipliers(): Promise<Record<string, number>> {
  if (cached) return cached;
  const { data } = await supabase.from('scoring_config').select('activity_type, multiplier');
  if (!data || data.length === 0) return FALLBACK_MULTIPLIERS;
  const map: Record<string, number> = {};
  for (const row of data) map[row.activity_type] = Number(row.multiplier);
  cached = map;
  return map;
}

// Must stay in lockstep with calculateEffortScore in the Strava edge functions
// (strava-webhook / strava-full-import / strava-backfill): score =
// minutes × multiplier (× intensity for scanned workouts), plus 0.5/km past 5km.
export function calculateEffortScore(
  activityType: string,
  durationSeconds: number,
  distanceMeters: number,
  multipliers: Record<string, number>,
  intensity = 100,
): number {
  const multiplier = multipliers[activityType] ?? DEFAULT_MULTIPLIER;
  const minutes = durationSeconds / 60;
  const km = distanceMeters / 1000;
  let score = minutes * multiplier * (intensity / 100);
  if (km > 5) score += (km - 5) * 0.5;
  return Math.round(score * 10) / 10;
}
