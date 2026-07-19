import { describe, it, expect, vi } from 'vitest';

// effort.ts imports the supabase client (for loadScoringMultipliers), which
// requires env vars at module load — mock it, these tests only exercise the
// pure formula.
vi.mock('../supabase', () => ({ supabase: {} }));

import { calculateEffortScore } from '../effort';

const MULTIPLIERS = { Run: 1.2, Ride: 1.0, Swim: 1.5, WeightTraining: 0.8 };

describe('calculateEffortScore', () => {
  // These expectations mirror the server formula in
  // supabase/functions/_shared/effortScore.ts — if one changes, both must.
  it('scores minutes × multiplier', () => {
    expect(calculateEffortScore('Run', 30 * 60, 0, MULTIPLIERS)).toBe(36); // 30 × 1.2
    expect(calculateEffortScore('Ride', 60 * 60, 0, MULTIPLIERS)).toBe(60);
    expect(calculateEffortScore('WeightTraining', 45 * 60, 0, MULTIPLIERS)).toBe(36);
  });

  it('uses the server default 0.8 for unknown types (NOT 1.0)', () => {
    // Regression: the old client copies defaulted to 1.0, so scanned workouts
    // of unlisted types scored 25% higher than Strava-imported ones.
    expect(calculateEffortScore('UnknownSport', 60 * 60, 0, MULTIPLIERS)).toBe(48); // 60 × 0.8
  });

  it('adds 0.5/km only past 5km', () => {
    const at5k = calculateEffortScore('Run', 30 * 60, 5000, MULTIPLIERS);
    const at7k = calculateEffortScore('Run', 30 * 60, 7000, MULTIPLIERS);
    expect(at5k).toBe(36); // no bonus at exactly 5km
    expect(at7k).toBe(37); // +1 for 2km past the threshold
  });

  it('applies the scan intensity factor as a percentage', () => {
    expect(calculateEffortScore('Run', 30 * 60, 0, MULTIPLIERS, 50)).toBe(18); // half intensity
    expect(calculateEffortScore('Run', 30 * 60, 0, MULTIPLIERS, 100)).toBe(36); // default
  });

  it('rounds to one decimal place', () => {
    expect(calculateEffortScore('Run', 17 * 60, 0, MULTIPLIERS)).toBe(20.4);
  });
});
