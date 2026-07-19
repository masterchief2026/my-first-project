-- Invite codes now work on PUBLIC teams too (decided 2026-07-08): the
-- join-request flow gates strangers arriving from Discover; a code is an
-- explicit invitation from someone inside, same trust as private teams.
--
-- This must be a SECURITY DEFINER RPC, not a policy loosening: the code is the
-- credential, and only the server can check it. (If RLS simply allowed active
-- self-inserts on public teams, a direct API call could skip the request queue
-- without knowing any code.)
--
-- Also upgrades an existing PENDING request to active when a valid code is
-- presented — previously that user was told they'd joined, then bounced by the
-- pending guard.
--
-- Run in the Supabase dashboard SQL editor.

create or replace function join_league_with_code(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
  existing_status text;
begin
  if auth.uid() is null then
    return json_build_object('error', 'not_authenticated');
  end if;

  select id, name into target
  from leagues
  where upper(invite_code) = upper(trim(code));

  if target.id is null then
    return json_build_object('error', 'invalid_code');
  end if;

  select status into existing_status
  from league_members
  where league_id = target.id and user_id = auth.uid();

  if existing_status = 'active' then
    return json_build_object('league_id', target.id, 'name', target.name, 'already_member', true);
  end if;

  if existing_status = 'pending' then
    update league_members
    set status = 'active'
    where league_id = target.id and user_id = auth.uid();
  else
    insert into league_members (league_id, user_id, role, status)
    values (target.id, auth.uid(), 'member', 'active');
  end if;

  return json_build_object('league_id', target.id, 'name', target.name, 'already_member', false);
end;
$$;
