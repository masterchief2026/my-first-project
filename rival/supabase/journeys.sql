-- Journeys: a league with a race attached becomes a shared destination. See
-- project_rival_journeys_concept.md — this is deliberately NOT a new system, it's
-- two nullable columns reusing the existing leagues/league_members/feed infrastructure.

alter table leagues add column race_id uuid references races(id) on delete set null;
alter table league_members add column personal_goal text;
