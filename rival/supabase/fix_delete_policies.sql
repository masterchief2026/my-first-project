-- "Disconnect Strava & remove imported activities" (profile.tsx) currently
-- silently no-ops: activities and milestones have NO DELETE policies, so RLS
-- blocks both deletes with 0 rows affected and no error. A user who explicitly
-- asks for their imported data to be removed keeps all of it and is told nothing.
--
-- FK on-delete already verified safe: activity_media / shared_images /
-- activity_sources cascade; exercise_entries set-null (lift history survives).
--
-- Run in the Supabase dashboard SQL editor.

create policy "Users can delete own activities"
  on activities for delete
  using (auth.uid() = user_id);

create policy "Users can delete own milestones"
  on milestones for delete
  using (auth.uid() = user_id);
