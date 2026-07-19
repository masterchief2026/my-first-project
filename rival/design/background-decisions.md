# RIVAL — background photo decisions

Source images live in `rival/assets/images/backgrounds/candidates/` (62 AI-generated
options banked 2026-07-10, deduped from Stitch exports). This file tracks which
photo is locked in for which screen as decisions are made — check here before
re-browsing the candidates folder.

| Screen | Locked photo | Notes |
|---|---|---|
| Onboarding: Welcome ("Fitness is better when it's shared") | `a-small-group-of-diverse-athletes-2.png` | 4-person high-five, mountain summit, golden hour — closest match to original Stitch mockup |
| Onboarding: Connect Data (Garmin/COROS sync) | `a-small-group-of-diverse-athletes-2-2.png` | 4 runners cresting a narrow ridge at sunrise, bright open sky — "mountain top running, multiple people" |
| Sign In ("Welcome Back") | `2-3-trail-runners-moving-along-a.png` | Same photo as the original "Alpine Momentum" Stitch mockup — the mockup only showed the lead (solo) runner because the Sign In card covers the other two |
| Team Hub / Team Feed | `ridge-runners-hazy-backlit.png` (added 2026-07-14, stitch-export-7) | 4 runners cresting a hazy backlit ridge, sun low behind the peak. Replaces the earlier "reuse Sign In's photo" choice — Team Hub now has its own distinct background. Focal point set to `55% 65%` (runners sit lower-center-right of frame) |
| Home Dashboard | `a-single-solo-athlete-standing-on.png` | Solo silhouette on a ridge, dramatic sunbeams cascading down both flanks, sun near-center. Chosen over `from-slightly-above-looking.png` (safer/more open-sky alternative, also fine) for more cinematic presence on the most-visited screen. Watch legibility of the hero "Total Time Earned" card against the brighter center of this photo when implementing |
| Activity (My Activities) | `handstand-airy-warehouse-gym.png` (added 2026-07-17) | Handstand in a bright, airy industrial gym — tall arched windows, hazy light, wooden floor. Replaces the earlier placeholder `handstand-crossfit-box.png` (darker, square-ish crop, freed back into the indoor-strength pool below). Subject roughly centered, no focal-point tweak applied yet — check centering once verified against a real account |

## Daily Moment — rotating pool (decided 2026-07-10)
Daily Motivation quote splash rotates its BACKGROUND PHOTO the same way it already
rotates quote text: deterministic by date (stable all day, changes at local
midnight), not random-per-open. Pool of 8 — all calm/open-sky/no-clutter so quote
text stays legible on top of any of them:

1. `a-solitary-sharp-mountain-peak.png` — single peak above clouds, warm sunset
2. `a-vast-sun-drenched-alpine.png` — solo hiker overlook, Dolomites, warm daylight
3. `a-rugged-winding-mountain-path.png` — sunburst over a jagged ridge trail
4. `a-clear-ascending-mountain-trail.png` — misty valley, distant peaks, cooler tone
5. `a-solitary-majestic-snow-capped.png` — clean iconic snow peak, pale morning light
6. Majestic Morning (from original Stitch export, `stitch-export-3/.../daily_moment_majestic_morning/screen.png`)
7. Above the Clouds (`stitch-export-2/.../daily_moment_above_the_clouds/screen.png`)
8. The Meadow Path (`stitch-export-3/.../daily_moment_the_meadow_path/screen.png`)

**Left out, not forgotten:** `a-winding-dirt-trail-through-a.png` (dark forest,
sunbeams) — genuinely different mood (enclosed, moody, no mountain) vs the rest
of the pool. Add it in later if variety is wanted; didn't want to sneak a tonal
outlier into the default set unapproved.

## Unassigned candidates — indoor strength (added 2026-07-15)
First gym-INTERIOR options in the gallery (everything else is alpine/outdoor
running). Moody warehouse boxes, god-rays, chalk dust — a distinct strength mood.
Not yet locked to a screen; strong fits for Lifts, Log Session, or CrossFit/Hyrox
contexts.
- `rope-climb-atelier-gym.png` — two women rope-climbing, "ATELIER" on the wall, dusty light beams
- `overhead-squat-warehouse-gym.png` — solo athlete in an overhead squat/snatch, gritty warehouse, god-rays
- `handstand-crossfit-box.png` — handstand in a brick CrossFit box, god-rays, chalk dust (square-ish crop). Freed back into this pool (2026-07-17) — was a placeholder on Activity, now replaced by `handstand-airy-warehouse-gym.png`.
- `deadlift-rival-plates-box.png` — deadlift in a gritty box, chalk cloud, god-rays; bumper plates read "RIVAL / ATHLETIC" (on-brand!) — **LOCKED as the Personal Bests / Lifts page background (2026-07-16, stitch-export-13)**, dimmed to ~28% opacity behind the glass hero.

## Unassigned candidates — urban / calm (added 2026-07-15)
- `handstand-city-plaza-dawn.png` — handstand in an empty urban plaza at dawn, skyline behind, centred subject, open pastel sky. Calm/aspirational mood; fits Yoga, calisthenics/mobility, or a calm splash (Daily Moment). Subject centred (~50%) — no focal-point tweak needed.

## Still to decide
Every other screen in `stitch_page_layouts.md` not listed above that wants a
background photo (Discover Teams, Goals, Races, Achievements, Recap, etc).
