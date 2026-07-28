-- Add a short bio to user profiles.
-- Personal-identity surface for the new Profile settings page (stitch-export-8):
-- a one-line "who I am / why I train" line. Optional, user-editable.
--
-- Run this in the Supabase SQL editor (Ricky runs migrations manually).

alter table public.users
  add column if not exists bio text;

-- Keep it short — this is a one-liner, not an essay. Enforce a sane cap so a
-- runaway paste can't bloat the profile row. NULL stays allowed (no bio set).
alter table public.users
  drop constraint if exists users_bio_length_chk;
alter table public.users
  add constraint users_bio_length_chk check (bio is null or char_length(bio) <= 280);
