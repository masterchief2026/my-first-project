---
name: rls-audit
description: Audit the live Supabase RLS policies for the RIVAL project — dump pg_policies, check every table against the known-correct security model, and flag open/missing/mis-scoped policies. Use after any schema or policy change, or periodically before launch.
---

# RIVAL RLS Audit

Introspect the LIVE database directly (never ask the user to paste query output):

```bash
cd rival
supabase db query "select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' order by tablename, cmd" --linked
supabase db query "select proname, pg_get_function_identity_arguments(oid) args, prosecdef, prosrc from pg_proc where pronamespace = 'public'::regnamespace and prosecdef" --linked
supabase db query "select tablename from pg_tables where schemaname='public' and tablename not in (select tablename from pg_policies where schemaname='public')" --linked
```

Also check RLS is actually ENABLED per table (`select relname, relrowsecurity from pg_class join pg_namespace on relnamespace=pg_namespace.oid where nspname='public' and relkind='r'`) — a table with policies but RLS disabled is fully open.

## What to check (the failure modes we've actually shipped)

1. **`qual: true` / `with_check: true` on any policy for `authenticated`** — fully open. RLS policies are permissive (OR'd), so ONE open policy silently defeats every scoped policy on the same table/cmd. This happened on `leagues` (leaked private invite codes), `activities`, `activity_media`, `milestones` (any client could insert fake milestones).
2. **Missing UPDATE/DELETE policies** — writes become silent no-ops (0 rows, no error). Happened on `league_members`: kick/promote/approve/decline all no-oped. For each table the app updates/deletes, confirm a policy exists for that cmd.
3. **Membership scoping** — anything league-scoped must go through `is_league_member(lid)` / `is_league_admin(lid)` (SECURITY DEFINER). Verify `is_league_member`'s `prosrc` still requires `status = 'active'` — pending join-requesters must not read team chat/feed/challenges.
4. **Self-privilege escalation on INSERT** — check `league_members` INSERT `with_check` still blocks self-assigning `role='admin'` (only the league's `created_by` may) and blocks `status='active'` self-insert on public teams (invite-code/private flow excepted).
5. **Sensitive-column exposure via broad SELECT** — invite codes on `leagues` must only be readable by members (`is_private = false OR is_league_member(id)`); invite-code lookup goes through the `lookup_league_by_invite_code` RPC returning only `id, name`.
6. **"Service can X" policies** — the service role BYPASSES RLS entirely; a policy "for service writes" with `with_check: true` actually opens the write to every authenticated client. Any such policy should be dropped, not scoped.
7. **New tables since last audit** — any table with RLS enabled but no policies (inaccessible: writes silently fail) or RLS disabled (fully open).

## Output

Report per table: OK / FINDING, with the exact policy text for findings and a proposed fix as a `.sql` file written to `rival/supabase/` for the user to run in the dashboard (schema changes are never applied directly — human-reviewed .sql is the pattern). After the user runs it, re-query pg_policies to verify it applied.
