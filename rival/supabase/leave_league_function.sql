-- Leaving a team only ever removed the caller's own league_members row (see
-- league_members_self_leave.sql) — nothing deleted the leagues row itself,
-- and there's deliberately no DELETE policy on leagues for the client to use
-- directly. That meant the last member leaving a team left an orphaned,
-- admin-less leagues row behind forever: unmanageable (Team Settings requires
-- an active admin) and, if public, permanently stuck accepting join requests
-- nobody could approve.
--
-- SECURITY DEFINER so it can delete the leagues row (no client-facing DELETE
-- policy exists for that), but scoped safely: it only ever removes the
-- caller's own membership (auth.uid(), not a client-supplied id) and only
-- deletes the league when zero active members remain afterward. Every other
-- table referencing league_id already CASCADEs (league_members, messages,
-- chat reads, feed_comments, challenges, weeks, matchups, weekly_scores,
-- feed_reactions) so this is the one place that needed to change.
create or replace function leave_league(p_league_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_remaining int;
  v_deleted boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from league_members
  where league_id = p_league_id and user_id = v_user_id;

  select count(*) into v_remaining
  from league_members
  where league_id = p_league_id and status = 'active';

  if v_remaining = 0 then
    delete from leagues where id = p_league_id;
    v_deleted := true;
  end if;

  return v_deleted;
end;
$$;

grant execute on function leave_league(uuid) to authenticated;
