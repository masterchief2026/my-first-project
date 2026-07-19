import { describe, it, expect } from 'vitest';
import { formatDuration } from '../format';

describe('formatDuration', () => {
  it('formats sub-hour durations as minutes', () => {
    expect(formatDuration(45 * 60)).toBe('45 min');
    expect(formatDuration(59 * 60)).toBe('59 min');
  });

  it('formats hours + minutes', () => {
    expect(formatDuration(102 * 60)).toBe('1h 42m');
  });

  // Regression: the same 2-hour ride used to show "2h" in the Team feed but
  // "2h 0m" on My Activities/AI Share — canonical form drops the "0m".
  it('drops trailing zero minutes on exact hours', () => {
    expect(formatDuration(2 * 3600)).toBe('2h');
  });

  it('returns empty string for missing/zero durations', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(undefined)).toBe('');
  });

  it('rounds seconds to the nearest minute', () => {
    expect(formatDuration(3580)).toBe('1h'); // 59.67 min rounds to 60 → 1h
    expect(formatDuration(29.6 * 60)).toBe('30 min');
  });
});
