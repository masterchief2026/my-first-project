-- Public teams are discoverable but no longer instantly joinable — see
-- project_rival_join_requests.md. Existing rows (created via invite code or
-- team creation) all default to 'active'; only the Discover "Join" flow now
-- inserts as 'pending', requiring an admin to approve before the person
-- becomes a real member anywhere else in the app.

alter table league_members add column status text not null default 'active';

alter table league_members add constraint league_members_status_check
  check (status in ('pending', 'active'));
