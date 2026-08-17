-- Team Board: pinned/important posts on the Team Hub Feed tab (wetsuit for
-- sale, run meetup times, ride requests, etc). Reuses league_messages with
-- kind='board' rather than a new table. Admins can pin/unpin; there was no
-- UPDATE policy on this table before, so pinning would otherwise silently
-- no-op under RLS.

alter table league_messages add column if not exists pinned boolean not null default false;
alter table league_messages add column if not exists title text;

-- 'board' wasn't an allowed kind — inserts were failing the check constraint.
alter table league_messages drop constraint if exists league_messages_kind_check;
alter table league_messages add constraint league_messages_kind_check
  check (kind = any (array['text'::text, 'session'::text, 'board'::text]));

drop policy if exists "League admins can pin board messages" on league_messages;
create policy "League admins can pin board messages"
  on league_messages for update
  using (is_league_admin(league_id))
  with check (is_league_admin(league_id));

-- Board posts also get a heart reaction + comment thread, same tables the
-- activity feed uses — widen these so target_type='board' is allowed too.
alter table feed_reactions drop constraint if exists feed_reactions_target_type_check;
alter table feed_reactions add constraint feed_reactions_target_type_check
  check (target_type = any (array['activity'::text, 'race'::text, 'session'::text, 'board'::text]));

alter table feed_comments drop constraint if exists feed_comments_target_type_check;
alter table feed_comments add constraint feed_comments_target_type_check
  check (target_type = any (array['activity'::text, 'race'::text, 'session'::text, 'board'::text]));
