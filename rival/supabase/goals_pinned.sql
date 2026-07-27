-- Lets a user manually pin which goal shows as the Today dashboard's
-- featured Focus card, instead of always relying on the nearest-deadline
-- heuristic. At most one pinned goal per user (enforced in application code,
-- not a DB constraint, since "unpin the others" is a two-step operation).
alter table goals add column if not exists pinned boolean not null default false;
