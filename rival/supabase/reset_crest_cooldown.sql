-- One-off: reset the 6-month crest regen cooldown for every team Ricky
-- admins, so he can test the new bg-removal step (generate-team-crest)
-- without waiting. Not a permanent bypass — just clears the timestamp that
-- gates regeneration, same as if the team had never generated a crest.

update leagues
set crest_generated_at = null
where id in (
  select lm.league_id
  from league_members lm
  where lm.user_id = '09b2e197-8257-4d7c-a0e6-12dc0429eeff'
    and lm.status = 'active'
    and lm.role = 'admin'
);
