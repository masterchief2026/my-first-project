-- Every screen queries activities by (user_id, started_at window) — week scores,
-- standings, feeds, streaks — but the only indexes are the pkey and the
-- (user_id, provider, provider_activity_id) unique. This is the single most
-- valuable index the app can have. Run in the Supabase dashboard SQL editor.

create index if not exists activities_user_started_idx
  on activities (user_id, started_at desc);
