-- Comprehensive RLS fixes found via a full pg_policies audit (2026-07-06).
-- Each section is independent — see comments for the specific bug closed.

-- ══════════════════════════════════════════════════════════════════════
-- 1. league_members had NO update policy and NO admin-delete policy.
--    Kick-member, promote/demote admin, and approve/decline join requests
--    all UPDATE or DELETE another user's row — every one of those was
--    silently doing nothing (0 rows affected, no error surfaced).
-- ══════════════════════════════════════════════════════════════════════
create or replace function is_league_admin(lid uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from league_members
    where league_id = lid and user_id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create policy "admins can update member rows"
  on league_members for update
  using (is_league_admin(league_id))
  with check (is_league_admin(league_id));

create policy "admins can remove member rows"
  on league_members for delete
  using (is_league_admin(league_id));

-- ══════════════════════════════════════════════════════════════════════
-- 2. league_members INSERT only checked auth.uid() = user_id — nothing
--    stopped a direct API call from self-assigning role='admin' on any
--    team, or inserting status='active' on a public team to skip the
--    approval flow built earlier today.
-- ══════════════════════════════════════════════════════════════════════
drop policy "league_members_insert" on league_members;

create policy "league_members_insert"
  on league_members for insert
  with check (
    auth.uid() = user_id
    and (
      role = 'member'
      or (role = 'admin' and exists (select 1 from leagues where id = league_id and created_by = auth.uid()))
    )
    and (
      status = 'pending'
      or exists (select 1 from leagues where id = league_id and created_by = auth.uid())
      or exists (select 1 from leagues where id = league_id and is_private = true)
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- 3. leagues had TWO fully-open SELECT policies (qual: true) — every
--    private team's invite_code, name, and settings were readable by any
--    authenticated user directly, making "private" not actually private.
--    The only legitimate reason to read a league you're not a member of
--    is the invite-code join flow, so that moves to a SECURITY DEFINER
--    RPC that only ever returns id/name, never exposes the full row.
-- ══════════════════════════════════════════════════════════════════════
drop policy "leagues_select" on leagues;
drop policy "leagues_select_by_code" on leagues;

create policy "leagues_select"
  on leagues for select
  using (is_private = false or is_league_member(id));

create or replace function lookup_league_by_invite_code(code text)
returns table(id uuid, name text)
language sql
security definer
as $$
  select id, name from leagues where invite_code = upper(trim(code));
$$;

-- ══════════════════════════════════════════════════════════════════════
-- 4. leagues UPDATE only checked league membership, not admin role — any
--    regular member could rename the team or flip public/private.
-- ══════════════════════════════════════════════════════════════════════
drop policy "League members can update league" on leagues;

create policy "admins can update league"
  on leagues for update
  using (is_league_admin(id))
  with check (is_league_admin(id));

-- ══════════════════════════════════════════════════════════════════════
-- 5. activities / activity_media SELECT policies were qual: true — named
--    "league members can read each other's activities" but actually open
--    to every authenticated user regardless of any relationship.
-- ══════════════════════════════════════════════════════════════════════
drop policy "League members can read each other's activities" on activities;

create policy "League members can read each other's activities"
  on activities for select
  using (
    exists (
      select 1 from league_members lm1
      join league_members lm2 on lm1.league_id = lm2.league_id
      where lm1.user_id = auth.uid() and lm1.status = 'active'
        and lm2.user_id = activities.user_id and lm2.status = 'active'
    )
  );

drop policy "Users can view media for activities they can see" on activity_media;

create policy "Users can view media for activities they can see"
  on activity_media for select
  using (
    exists (
      select 1 from activities a
      join league_members lm1 on lm1.user_id = auth.uid() and lm1.status = 'active'
      join league_members lm2 on lm2.league_id = lm1.league_id and lm2.user_id = a.user_id and lm2.status = 'active'
      where a.id = activity_media.activity_id
    )
    or exists (select 1 from activities a where a.id = activity_media.activity_id and a.user_id = auth.uid())
  );

-- ══════════════════════════════════════════════════════════════════════
-- 6. milestones INSERT had with_check: true — any authenticated client
--    (not just the service role) could insert a fake milestone for any
--    user_id. Service-role edge functions bypass RLS entirely by design,
--    so this policy has no legitimate use case at all — just drop it.
-- ══════════════════════════════════════════════════════════════════════
drop policy "Service can insert milestones" on milestones;
