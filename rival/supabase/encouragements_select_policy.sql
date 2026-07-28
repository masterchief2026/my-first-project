-- Lets a user see who they've already sent an encouragement to today, so the
-- "📣 Encourage" button can correctly show "✓ Encouraged" after a page reload
-- instead of just for the current session. Still can't read anyone else's.

create policy "select own sent encouragements"
  on encouragements for select
  using (auth.uid() = from_user_id);
