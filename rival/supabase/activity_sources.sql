-- Cross-source activity dedup. See supabase/functions/_shared/activityDedup.ts.
-- Only edge functions (service role) touch this table today — no client UI reads it,
-- so RLS is enabled with no policies (deny by default for anon/authenticated).

create table activity_sources (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities(id) on delete cascade not null,
  provider text not null,
  provider_activity_id text not null,
  raw_payload jsonb,
  created_at timestamptz default now() not null,
  unique (provider, provider_activity_id)
);

create index on activity_sources(activity_id);

alter table activity_sources enable row level security;

-- Backfill: give every existing Strava-sourced activity a matching source row so old
-- and new data share the same matching path going forward.
insert into activity_sources (activity_id, provider, provider_activity_id)
select id, provider, provider_activity_id
from activities
where provider_activity_id is not null
on conflict (provider, provider_activity_id) do nothing;
