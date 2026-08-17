-- exercise_entries only had a "view own" SELECT policy, so team-feed.tsx's
-- (and league.tsx's) PB-detection query — `.from('exercise_entries')...in('user_id', memberIds)`
-- — silently returned rows for the viewer only, never teammates. RLS is
-- permissive (policies OR together, see AGENTS.md), so this just adds
-- teammate visibility without touching the existing "own" policy. Mirrors
-- the existing "League members can read each other's activities" policy on
-- the activities table exactly.

create policy "League members can read each other's exercise entries"
on exercise_entries for select
using (
  exists (
    select 1
    from league_members lm1
    join league_members lm2 on lm1.league_id = lm2.league_id
    where lm1.user_id = auth.uid()
      and lm1.status = 'active'
      and lm2.user_id = exercise_entries.user_id
      and lm2.status = 'active'
  )
);
