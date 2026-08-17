-- Lets the user reposition a cover photo's crop (drag-to-adjust "focal
-- point") instead of always cropping to dead-center. Fractions 0-1 across
-- the image; null means "use center", same as today's behavior, so existing
-- photos need no backfill.
alter table activities
  add column if not exists photo_focal_x real,
  add column if not exists photo_focal_y real;

alter table activities
  add constraint activities_photo_focal_x_range check (photo_focal_x is null or (photo_focal_x >= 0 and photo_focal_x <= 1)),
  add constraint activities_photo_focal_y_range check (photo_focal_y is null or (photo_focal_y >= 0 and photo_focal_y <= 1));
