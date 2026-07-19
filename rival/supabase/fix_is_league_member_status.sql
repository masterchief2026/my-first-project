-- CRITICAL: is_league_member() only checked that a league_members row
-- exists for (league_id, user_id) — it never checked `status`. Since almost
-- every team-scoped RLS policy (feed_comments, feed_reactions,
-- league_messages, league_challenges, league_vs_league_challenges,
-- weekly_scores, weeks, matchups) is built on this function, a PENDING join
-- request currently passes as a full member at the database level — they
-- could read a team's private chat/feed/challenges directly even though the
-- app UI correctly hides "View" access until approved (see
-- project_rival_join_requests.md). This closes that gap at its actual
-- source instead of only in app-level queries.

create or replace function is_league_member(lid uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from league_members where league_id = lid and user_id = auth.uid() and status = 'active'
  );
$$;
