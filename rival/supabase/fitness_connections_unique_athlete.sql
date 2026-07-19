-- Prevents the same Strava (or other provider) account from being linked to
-- two different RIVAL profiles at once. Without this, accidentally
-- authorizing someone else's Strava during connect silently double-links
-- it — their history imports onto your profile, and once they later
-- connect it correctly to their own account, strava-webhook's .single()
-- lookup by provider_user_id starts erroring for both accounts (ambiguous
-- match), breaking auto-sync for both.

alter table fitness_connections
  add constraint fitness_connections_provider_athlete_unique
  unique (provider, provider_user_id);
