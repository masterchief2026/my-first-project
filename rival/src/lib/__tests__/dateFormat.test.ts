import { describe, it, expect } from 'vitest';
import { isoToDisplayDate, displayToIsoDate } from '../dateFormat';

describe('displayToIsoDate', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(displayToIsoDate('25/12/2026')).toBe('2026-12-25');
    expect(displayToIsoDate('01/01/2026')).toBe('2026-01-01');
  });

  it('rejects impossible dates', () => {
    expect(displayToIsoDate('31/02/2026')).toBeNull(); // Feb 31
    expect(displayToIsoDate('29/02/2026')).toBeNull(); // 2026 not a leap year
    expect(displayToIsoDate('00/06/2026')).toBeNull();
    expect(displayToIsoDate('32/01/2026')).toBeNull();
    expect(displayToIsoDate('15/13/2026')).toBeNull();
  });

  it('accepts leap-day on real leap years', () => {
    expect(displayToIsoDate('29/02/2028')).toBe('2028-02-29');
  });

  it('rejects malformed input', () => {
    expect(displayToIsoDate('2026-12-25')).toBeNull(); // ISO passed where display expected
    expect(displayToIsoDate('25-12-2026')).toBeNull();
    expect(displayToIsoDate('')).toBeNull();
    expect(displayToIsoDate('banana')).toBeNull();
  });
});

describe('isoToDisplayDate', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(isoToDisplayDate('2026-12-25')).toBe('25/12/2026');
  });

  it('round-trips with displayToIsoDate', () => {
    for (const iso of ['2026-01-01', '2026-12-31', '2028-02-29']) {
      expect(displayToIsoDate(isoToDisplayDate(iso)!)).toBe(iso);
    }
  });
});
