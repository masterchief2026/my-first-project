-- Links a logged activity to a race, so the Activity Journal can show a
-- Race badge without the user re-entering anything. Nullable: most
-- activities aren't races. On race delete, unlink rather than cascade —
-- losing the race record shouldn't delete the workout you actually logged.
alter table activities add column if not exists race_id uuid references races(id) on delete set null;
create index if not exists activities_race_id_idx on activities(race_id) where race_id is not null;
