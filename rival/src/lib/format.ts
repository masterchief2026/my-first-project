// Shared display formatting. formatDuration was previously forked 3 ways with
// diverging output — the same 2-hour ride showed "2h" in Team feed but
// "2h 0m" on My Activities and AI Share. This canonical version uses the
// cleaner form: no trailing "0m", and empty string for missing durations.
// (scan-workout's formatDurationHMS is clock-style "1:23:45" — a different
// format for a different purpose, intentionally not merged here.)

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Clock-style "43:09" / "1:23:45" — shows seconds, unlike formatDuration above.
export function formatDurationClock(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Goal-time entry mask: a bare "245" is genuinely ambiguous — H:MM or MM:SS
// — so instead of guessing, digits fill in from the right like a stopwatch.
// Typing "145" reads 00:01:45 (1 min 45 sec); one more digit, "1450", reads
// 00:14:50; "14500" reads 01:45:00 (1 hr 45 min). The user sees exactly
// which digits landed in which place, live, rather than trusting a silent
// interpretation of what they meant. Non-digit paste content (":", spaces)
// is stripped, so pasting "1:45:00" also lands correctly. Empty input stays
// empty — this field is optional and shouldn't silently become "00:00:00".
export function formatGoalTimeMask(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const padded = digits.slice(-6).padStart(6, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
}
