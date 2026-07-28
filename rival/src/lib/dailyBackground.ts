// Daily Motivation splash background photo rotation — pool locked in
// rival/design/background-decisions.md (2026-07-10). Deterministic by date
// (day-of-year, same mechanism as picking a stable value per calendar day)
// so the photo is stable across app opens within a day and changes at
// local midnight, matching the quote's once-per-day display behavior.
//
// NOTE: the decisions doc lists 8 photos, but only these 5 exist as clean
// standalone image files today — "Majestic Morning" / "Above the Clouds" /
// "The Meadow Path" only exist baked into full Stitch screen mockups with
// their own quote text already rendered on top, which would double up with
// our real quote text. Add them here once clean versions are exported.
export const DAILY_BACKGROUNDS = [
  require('../../assets/images/backgrounds/optimized/a-solitary-sharp-mountain-peak.jpg'),
  require('../../assets/images/backgrounds/optimized/a-vast-sun-drenched-alpine.jpg'),
  require('../../assets/images/backgrounds/optimized/a-rugged-winding-mountain-path.jpg'),
  require('../../assets/images/backgrounds/optimized/a-clear-ascending-mountain-trail.jpg'),
  require('../../assets/images/backgrounds/optimized/a-solitary-majestic-snow-capped.jpg'),
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDailyBackground() {
  const index = dayOfYear(new Date()) % DAILY_BACKGROUNDS.length;
  return DAILY_BACKGROUNDS[index];
}
