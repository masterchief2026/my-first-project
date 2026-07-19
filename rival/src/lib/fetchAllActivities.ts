import { supabase } from './supabase';

const PAGE = 1000;

// PostgREST silently caps un-ranged selects at 1000 rows. A user who imports a
// full multi-year Strava history has more than that, and every lifetime stat,
// streak, or achievement computed from a capped result is silently wrong.
// Pages through the complete set; ordering makes the pages stable.
export async function fetchAllActivities(userId: string, columns: string): Promise<any[]> {
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('activities')
      .select(columns)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...(data as any[]));
    if (data.length < PAGE) break;
  }
  return all;
}
