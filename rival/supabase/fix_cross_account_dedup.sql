-- Fixes the root cause behind the "Strava full-import stops at an old date"
-- bug: `activities.provider_activity_id` and `activity_sources` were both
-- GLOBALLY unique, so once one RIVAL account claimed a Strava activity ID,
-- no other account could ever import that same physical activity under its
-- own profile — the insert would silently violate the constraint (swallowed
-- by existing `if (!error) saved++` checks) or get redirected onto the
-- wrong account's row. Both need to be unique PER USER, not globally.

-- ── activities ──────────────────────────────────────────────────────────
alter table activities drop constraint if exists activities_provider_activity_id_key;
alter table activities drop constraint if exists activities_provider_activity_id_unique;
alter table activities add constraint activities_user_provider_activity_unique
  unique (user_id, provider, provider_activity_id);

-- ── activity_sources ────────────────────────────────────────────────────
alter table activity_sources add column if not exists user_id uuid references users(id) on delete cascade;

update activity_sources asrc
set user_id = a.user_id
from activities a
where a.id = asrc.activity_id and asrc.user_id is null;

alter table activity_sources alter column user_id set not null;

-- Drop whatever the old (provider, provider_activity_id) unique constraint
-- is actually named, without needing to know it in advance.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'activity_sources'::regclass and contype = 'u'
  loop
    execute format('alter table activity_sources drop constraint %I', r.conname);
  end loop;
end $$;

alter table activity_sources add constraint activity_sources_user_provider_activity_unique
  unique (user_id, provider, provider_activity_id);
