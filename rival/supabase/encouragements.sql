-- Friend-to-friend encouragement push notifications. See
-- project_rival_encouragement_feature.md — quick-tap or custom message from
-- a teammate, sent as a push notification. Table is written exclusively by
-- the send-encouragement edge function (service role) so the one-per-day
-- cap can't be bypassed by a client calling insert directly — no
-- client-facing RLS policies are needed.

create table encouragements (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users(id) on delete cascade,
  to_user_id uuid not null references users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table encouragements enable row level security;

-- Postgres won't allow a plain `::date` cast in an index expression (it's
-- STABLE, not IMMUTABLE, since it depends on session timezone). Supabase
-- connections always run in UTC, so wrapping it in our own IMMUTABLE
-- function is safe here and gives us a day-bucketed unique constraint.
create or replace function encouragement_day(ts timestamptz) returns date as $$
  select ts::date
$$ language sql immutable;

-- One encouragement per sender/recipient pair per calendar day.
create unique index encouragements_daily_unique
  on encouragements (from_user_id, to_user_id, encouragement_day(created_at));
