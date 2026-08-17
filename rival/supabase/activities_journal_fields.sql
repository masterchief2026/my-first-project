-- Fields for the Activity Journal diary viewer: where you were, who you were
-- with, and whether you've pinned this one as a favorite. All nullable/
-- optional — most activities won't have any of these filled in.
--
-- NOT included: time-of-day/temperature/weather. The mockup shows small
-- read-only chips for these, but there's no real data source to populate
-- them (no weather API, no geolocation capture at log time) — adding the
-- columns without a writer would just be dead schema. Revisit if/when a
-- weather integration is actually planned.
alter table activities add column if not exists location text;
alter table activities add column if not exists companions text;
alter table activities add column if not exists pinned boolean not null default false;
