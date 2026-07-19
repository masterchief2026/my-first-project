-- Lets a member remove themselves from a team. The existing DELETE policy on
-- league_members likely only covers an admin removing someone else (that's
-- how "kick member" already works) — self-leave by a non-admin is a
-- different case and needs its own policy, or the delete silently affects
-- zero rows under RLS with no visible error.

create policy "leave own team membership"
  on league_members for delete
  using (auth.uid() = user_id);
