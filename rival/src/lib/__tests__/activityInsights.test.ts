import { describe, it, expect } from 'vitest';
import { computeActivityInsight, InsightActivity } from '../activityInsights';

// Helper: build an activity N days before a fixed "now".
const NOW = new Date('2026-07-16T12:00:00Z').getTime();
function act(daysAgo: number, over: Partial<InsightActivity> = {}): InsightActivity {
  return {
    activity_type: 'Run',
    started_at: new Date(NOW - daysAgo * 86400000).toISOString(),
    duration_seconds: 1800,
    distance_meters: 5000,
    ...over,
  };
}

describe('computeActivityInsight', () => {
  it('returns null when there is no history to compare against', () => {
    const a = act(0);
    expect(computeActivityInsight(a, [a])).toBeNull();
  });

  it('flags a longest run within a trailing window', () => {
    // Distances chosen to avoid crossing a round-number milestone (5/10/15…km),
    // so this isolates the trailing-window record check from the milestone one.
    const today = act(0, { distance_meters: 8400 });
    const history = [today, act(10, { distance_meters: 6200 }), act(20, { distance_meters: 7000 })];
    const r = computeActivityInsight(today, history);
    expect(r?.tone).toBe('record');
    expect(r?.text).toMatch(/Longest run in/);
  });

  it('does NOT show the record line when an all-time PB badge already covers it', () => {
    const today = act(0, { distance_meters: 8400 });
    const history = [today, act(10, { distance_meters: 6200 }), act(20, { distance_meters: 7000 })];
    const r = computeActivityInsight(today, history, /* hasPbBadge */ true);
    // Falls through to a non-record insight (or null), never the "Longest" line.
    expect(r?.text ?? '').not.toMatch(/Longest/);
  });

  it('flags a round-number distance milestone crossed for the first time', () => {
    const today = act(0, { distance_meters: 42000 });
    const history = [today, act(10, { distance_meters: 21000 }), act(20, { distance_meters: 15000 })];
    const r = computeActivityInsight(today, history);
    expect(r?.tone).toBe('record');
    expect(r?.text).toBe('First run over 40 km');
  });

  it('flags a highest-elevation record in a window', () => {
    // Distance is shorter than prior runs so the distance-record check doesn't
    // fire first — isolates the elevation check.
    const today = act(0, { distance_meters: 5000, elevation_meters: 900 });
    const history = [
      today,
      act(10, { distance_meters: 6200, elevation_meters: 400 }),
      act(20, { distance_meters: 7000, elevation_meters: 300 }),
    ];
    const r = computeActivityInsight(today, history);
    expect(r?.tone).toBe('record');
    expect(r?.text).toMatch(/highest elevation/);
  });

  it('counts frequency within the current week', () => {
    // Three runs in the same Mon-start week; the third should read "3rd run this week".
    const monday = act(1);
    const tuesday = act(0, { distance_meters: 3000 }); // shorter, so not a record
    const sunday = act(2, { distance_meters: 3000 });
    const r = computeActivityInsight(tuesday, [monday, sunday, tuesday]);
    expect(r?.tone).toBe('streak');
    expect(r?.text).toMatch(/run this week/);
  });

  it('recognises a comeback after a long gap', () => {
    const today = act(0, { distance_meters: 3000 });
    const longAgo = act(60, { distance_meters: 3000 });
    const r = computeActivityInsight(today, [today, longAgo]);
    expect(r?.tone).toBe('comeback');
    expect(r?.text).toMatch(/First run in \d+ weeks/);
  });
});
