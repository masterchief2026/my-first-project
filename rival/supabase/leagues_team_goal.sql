-- Team Target: a cumulative team-wide goal ("1000km by Dec 1") set at team
-- creation, distinct from Journeys (leagues.race_id — a real dated event) and
-- from league_challenges (1v1 head-to-head). Everyone's logged activity from
-- the team's creation date counts toward one shared number with a deadline.
-- Mutually exclusive with race_id in the app UI, enforced here too.

alter table leagues add column if not exists goal_metric text
  check (goal_metric in ('xp', 'distance', 'elevation', 'duration', 'activities'));
alter table leagues add column if not exists goal_target numeric;
alter table leagues add column if not exists goal_target_date date;

alter table leagues add constraint leagues_goal_or_race_not_both
  check (race_id is null or goal_metric is null);
