-- The crest generated today for Squampton Creew is correct (transparent
-- background, verified directly from storage) — the app was just showing a
-- browser-cached copy of the old opaque image because the storage URL never
-- changes between regenerations. generate-team-crest now appends a cache-
-- busting ?v= param to logo_url going forward; this backfills that same fix
-- for crests that were already regenerated before the deploy, so nobody has
-- to burn another 6-month cooldown just to get the URL to bust.
update leagues
set logo_url = logo_url || '?v=' || extract(epoch from crest_generated_at)::bigint
where crest_generated_at is not null
  and logo_url is not null
  and logo_url not like '%?v=%';
