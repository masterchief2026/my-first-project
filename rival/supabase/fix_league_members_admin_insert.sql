-- Fixes "Team was created but adding you as admin failed" for PRIVATE teams.
--
-- league_members_insert's WITH CHECK verifies the inserting user created the
-- league with a raw `EXISTS (SELECT 1 FROM leagues WHERE ... created_by =
-- auth.uid())` subquery. That subquery is itself subject to leagues' own RLS
-- (leagues_select: is_private = false OR is_league_member(id)). For a
-- brand-new PRIVATE team, the creator isn't a member yet — that's exactly
-- what this insert is trying to establish — so the subquery sees zero rows
-- and the check fails even though created_by really does match. Public teams
-- never hit this because is_private = false alone satisfies leagues_select
-- regardless of membership, so it went unnoticed until private-team creation
-- was actually tested.
--
-- Fix: a SECURITY DEFINER helper (bypasses leagues' RLS, same pattern as the
-- existing is_league_member/is_league_admin) replaces the raw subquery for
-- the "are you the creator" checks.
--
-- NOTE: the pre-existing final OR branch on the status check — allowing an
-- insert when `leagues.is_private = true` alone, with no creator/ownership
-- check — is left exactly as it was (still a plain subquery, still blocked
-- by the same RLS for any non-member). It has never actually been reachable
-- given this bug, so leaving it inert rather than "fixing" it avoids
-- accidentally opening a hole that lets any authenticated user insert an
-- active membership row into any private league. Flag for Ricky to confirm
-- intent before touching it.

create or replace function is_league_creator(lid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from leagues where id = lid and created_by = auth.uid()
  );
$$;

grant execute on function is_league_creator(uuid) to authenticated;

drop policy if exists "league_members_insert" on league_members;

create policy "league_members_insert" on league_members
for insert
with check (
  auth.uid() = user_id
  and (
    role = 'member'
    or (role = 'admin' and is_league_creator(league_id))
  )
  and (
    status = 'pending'
    or is_league_creator(league_id)
    or exists (select 1 from leagues where leagues.id = league_members.league_id and leagues.is_private = true)
  )
);
