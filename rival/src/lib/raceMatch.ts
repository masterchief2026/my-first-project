import { supabase } from './supabase';

// races.race_date is a bare 'YYYY-MM-DD' column — compare it against the
// activity's LOCAL calendar date, built via getFullYear/Month/Date rather
// than new Date(iso).toISOString(), which would shift the date across a
// UTC day boundary for anyone (Ricky included, NZ is UTC+12/13) logging near
// midnight local time.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Only auto-links when exactly one of the user's races falls on that date —
// with two races on the same day there's no way to guess which one this
// activity belongs to, so it's left unlinked rather than picked arbitrarily.
export async function findMatchingRaceId(userId: string, startedAtIso: string): Promise<string | null> {
  const dateStr = localDateStr(new Date(startedAtIso));
  const { data, error } = await supabase
    .from('races')
    .select('id')
    .eq('user_id', userId)
    .eq('race_date', dateStr);
  if (error || !data || data.length !== 1) return null;
  return data[0].id;
}
