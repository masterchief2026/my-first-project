import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const LEVELS = [
  { level: 1,  name: 'Rookie',    minXp: 0 },
  { level: 2,  name: 'Hustler',   minXp: 200 },
  { level: 3,  name: 'Warrior',   minXp: 600 },
  { level: 4,  name: 'Elite',     minXp: 1500 },
  { level: 5,  name: 'Champion',  minXp: 3000 },
  { level: 6,  name: 'Legend',    minXp: 6000 },
  { level: 7,  name: 'Mythic',    minXp: 12000 },
  { level: 8,  name: 'Immortal',  minXp: 22000 },
  { level: 9,  name: 'God',       minXp: 40000 },
  { level: 10, name: 'Unrivaled', minXp: 75000 },
];

function getLevel(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) return LEVELS[i];
  }
  return LEVELS[0];
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const previousYear = currentYear - 1;

  // Find the season that just ended (last year) and hasn't been closed yet
  const { data: prevSeason } = await supabase
    .from('seasons')
    .select('id, year')
    .eq('year', previousYear)
    .is('closed_at', null)
    .maybeSingle();

  if (!prevSeason) {
    return new Response(JSON.stringify({ message: 'No season pending rollover' }), { status: 200 });
  }

  const seasonStart = new Date(Date.UTC(previousYear, 0, 1)).toISOString();
  const seasonEnd = new Date(Date.UTC(currentYear, 0, 1)).toISOString();

  // Snapshot per-user final XP for the season
  const { data: allUsers } = await supabase.from('users').select('id');
  let userResultsSaved = 0;

  for (const u of allUsers || []) {
    const { data: acts } = await supabase
      .from('activities')
      .select('effort_score')
      .eq('user_id', u.id)
      .gte('started_at', seasonStart)
      .lt('started_at', seasonEnd);

    const finalXp = (acts || []).reduce((s, a) => s + (a.effort_score || 0), 0);
    if (finalXp <= 0) continue;

    const lvl = getLevel(finalXp);
    const { error } = await supabase.from('season_results').upsert({
      season_id: prevSeason.id,
      user_id: u.id,
      final_xp: Math.round(finalXp * 10) / 10,
      final_level: lvl.level,
      final_rank_name: lvl.name,
    }, { onConflict: 'season_id,user_id' });

    if (!error) userResultsSaved++;
  }

  // Snapshot per-league final standings for the season
  const { data: leagues } = await supabase.from('leagues').select('id');
  let leagueResultsSaved = 0;

  for (const league of leagues || []) {
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', league.id)
      .eq('status', 'active');

    const scored = await Promise.all(
      (members || []).map(async (m: any) => {
        const { data: acts } = await supabase
          .from('activities')
          .select('effort_score')
          .eq('user_id', m.user_id)
          .gte('started_at', seasonStart)
          .lt('started_at', seasonEnd);
        const score = (acts || []).reduce((s, a) => s + (a.effort_score || 0), 0);
        return { user_id: m.user_id, score };
      })
    );

    scored.sort((a, b) => b.score - a.score);

    for (let i = 0; i < scored.length; i++) {
      if (scored[i].score <= 0) continue;
      const { error } = await supabase.from('league_season_results').insert({
        season_id: prevSeason.id,
        league_id: league.id,
        user_id: scored[i].user_id,
        final_score: Math.round(scored[i].score * 10) / 10,
        final_position: i + 1,
      });
      if (!error) leagueResultsSaved++;
    }
  }

  // Close the old season
  await supabase.from('seasons').update({ closed_at: now.toISOString() }).eq('id', prevSeason.id);

  // Open the new season (idempotent)
  await supabase.from('seasons').upsert({
    year: currentYear,
    start_date: seasonEnd,
    end_date: new Date(Date.UTC(currentYear + 1, 0, 1)).toISOString(),
  }, { onConflict: 'year' });

  return new Response(JSON.stringify({
    message: `Season ${previousYear} closed`,
    userResultsSaved,
    leagueResultsSaved,
  }), { status: 200 });
});
