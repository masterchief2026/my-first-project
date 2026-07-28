import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSeasonStartISO, getSeasonEndISO, getCurrentSeasonYear, daysUntilSeasonEnd } from '../season';

describe('season boundaries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('season runs Jan 1 UTC to Jan 1 UTC', () => {
    expect(getSeasonStartISO(2026)).toBe('2026-01-01T00:00:00.000Z');
    expect(getSeasonEndISO(2026)).toBe('2027-01-01T00:00:00.000Z');
  });

  // KNOWN QUIRK (documenting current behavior, not endorsing it): season year
  // comes from the device's LOCAL calendar year, but the season window is UTC
  // Jan 1. In NZ (UTC+13 in January), activities logged between midnight and
  // ~1pm on Jan 1 belong to the NEW local year but fall BEFORE the UTC season
  // start — they credit the previous season. If this test starts failing
  // because the boundary was made timezone-aware, that's an improvement:
  // update the test, don't revert the code.
  it('uses the local calendar year for the current season', () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00'));
    expect(getCurrentSeasonYear()).toBe(2026);
    expect(getSeasonStartISO()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('counts days until season end', () => {
    vi.setSystemTime(new Date('2026-12-31T00:00:00Z'));
    expect(daysUntilSeasonEnd()).toBe(1);
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(daysUntilSeasonEnd()).toBe(365);
  });
});
