-- Manual "pin" for which team shows as the primary hero card on the Teams
-- page, overriding the automatic "most recently active" pick. At most one
-- pinned team per user — enforced by the app (unpins the previous one before
-- setting a new one), not a DB constraint, matching how other simple toggles
-- in this app are handled.
alter table league_members add column if not exists pinned boolean not null default false;
