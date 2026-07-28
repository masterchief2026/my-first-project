# RIVAL — per-screen layout specs for Stitch

Everything below reflects what's actually built. Each screen: elements in **hierarchy order (top → bottom)**, with the ONE primary action bolded. Design mobile-first (~390px); desktop is the enhancement.

Locked vocabulary: **Team, Effort, Respect, Inspired, Impact, Unrivaled**. Never: XP, points, league, squad, crew, grind.

---

## 1. Welcome / Onboarding ✅ (already in Stitch)
1. RIVAL logo
2. Tagline ("Fitness is better when it's shared" direction is on-brand)
3. **Get Started** (primary)
4. Sign In (secondary link)

## 2. Sign In / Sign Up
1. Title
2. Email-or-username + password fields (show/hide toggle)
3. Remember me · Forgot password?
4. **Sign In / Create Account** (primary)
5. Swap link (Don't have an account? / Already have one?)
- States: inline error box, reset-email-sent success box

## 3. Home (Dashboard) ✅ — most important screen
1. Header: logo · icon nav (Plan / Goals / Races / Achievements / Friends) · avatar
2. Greeting ("Hey, [Name]") + daily line (quote, calm tone)
3. Hero: **Time Earned** (big number, e.g. "124h 32m") — this IS the hero stat, keep it
4. 3 stat tiles: Streak (weeks) · Level/Rank (mini progress bar) · Days to next race
5. **+ Add Workout** (primary action of the whole app)
6. AI Share promo banner ("Turn your last run into a share card")
7. Your Teams: team cards (logo, name, "3 new" activity badge) + empty state
8. Create / Join / Discover buttons (secondary row)
9. Lifetime grid: Lifetime Effort · Activities · km · m climbed
10. By-activity-type card grid (icon + distance or session count)
11. Personal bests grid + "See all"
12. Strava: connect CTA card (not connected) OR "✓ Connected" + Sync button
- Season countdown banner appears in the last 30 days of the year

## 4. Team Hub ✅ — second most important
1. Header: back · team name · invite code with copy button · Settings gear (admins only)
2. **Standings** (the heart of the screen): ranked member rows — rank #, avatar, name, this-week Effort, trend arrow ↑↓, MVP badge on last week's winner; week arrows ‹ › to change week
3. Member's personal race goal line (Journey teams): tap to edit own
4. Tabs: **Feed / Chat / Sessions / Challenges**
5. Feed tab: activity cards (avatar, name, type icon, duration/distance, Effort earned, photo gallery) · race announcement cards · reaction buttons as words: **Respect · Inspired** (+ counts) · expandable comments · Encourage button (1/day per person)
6. Chat tab: messages, @mention autocomplete, session invite cards with RSVP ("I'm in" + attendee avatars), input bar
7. Sessions tab: Upcoming/History toggle · session cards (type, time, location, RSVP count) · **Quick Train** button · composer modal (type, date, time, location, note)
8. Challenges tab: 1v1 challenge cards (two progress bars head-to-head, days left, accept/decline when pending) · "Challenge" button per member · Team-vs-Team section
9. Leave Team (bottom, destructive-quiet)
- States: feed empty (new team), pending-request user is bounced (never sees this screen)

## 5. Team Settings (admin only)
1. Team logo (upload/change)
2. Team name (inline edit)
3. Visibility toggle: Private (invite only) / Public (discoverable — join by request OR invite code)
4. **Join Requests**: pending list with Approve / Decline per row
5. Members list: name, Admin badge, Make/Remove Admin, Remove (destructive)

## 6. Create Team
1. Title + one-line explainer
2. Team name input
3. Private toggle + explanation line
4. "Make it a Journey" optional radio list: attach one of your races (everyone trains toward it)
5. **Create Team**

## 7. Join Team (by code)
1. Title
2. Large centered code input (6–8 chars)
3. **Join Team**
- Note: codes now work on public teams too (skip the request queue)

## 8. Discover Teams
1. Title + "Request to join a public team"
2. Search bar
3. Team cards: logo, name, member count, one button with 3 states: **Request to join** / Requested / View
- Empty state: "No public teams found — create one and make it public"

## 9. Profile ✅ (partially in Stitch)
1. Avatar (editable) · display name · @username · lifetime training time line
2. Hero rank card: rank icon + name (colored), "Level X · N Effort", season countdown, progress bar to next level; special "You are Unrivaled" max state
3. Stat tiles: This week Effort · Lifetime Effort · Activities · km · m climbed
4. Time Earned hero card
5. Streak card: current weeks, 2/4/8/12-week tier ladder with checkmarks — pure consistency record, NO bonus/multiplier/penalty language
6. Milestones: 100h / 500h / 1,000h / 5,000h badges (locked = greyed)
7. **Impact card**: "N times people have shown up for your effort · by M people"
8. Past seasons list (year, rank, Effort)
9. Settings: display-style picker (3 options) · daily quote tone (Blunt/Balanced/Encouraging)
10. Quick links: Ranks · Achievements · Monthly Recap · Year Wrap-up
11. Strava: connected status, Import full history, Disconnect (modal: keep or remove imported data)
12. Sign Out · **Delete Account** (danger zone, typed confirmation — new, required for App Store)

## 10. My Activities
1. Header: refresh · weekly-scan · **+ Scan** buttons
2. "This week: N Effort" banner
3. Filter bar: type filter chips · Latest/Oldest sort · PR-only toggle
4. Weekly sections (header = week label + week total Effort)
5. Activity cards: type icon, editable name, multiplier badge, PR flame badge, meta line (type · date · duration · distance), Effort score, action icons (photo / edit / AI share), lift exercise breakdown, media gallery
- Link banner to Lifts ("Your Lifts — PBs & goals →")
- States: no activities, no filter matches, NO-PHOTO card (most Strava imports have no image — design this)

## 11. Scan Workout ("Log Session" ✅)
1. Photo picker (camera/gallery) OR manual entry
2. Extracted preview form: type chips, duration, distance, elevation, name, date, notes
3. Exercise list (name/sets/reps/weight, lift tag picker, add/remove)
4. Add more media (2 photos + 1 video)
5. **Save Workout**
- States: scanning (loading), extraction error

## 12. Weekly Scan
1. Title + "attach a photo to each day, scan all at once"
2. Mon–Sun day grid (empty / has photos / future-disabled)
3. Per-day photo thumbnails
4. **Scan & Save All (N)**
5. Results list per day: waiting / scanning spinner / "✓ Run — +42 Effort" (renamable) / error

## 13. Lifts
1. Title + "+ Log a different lift"
2. Per-lift cards: name, PB ("120kg · set 12 Mar"), progress bar to goal with milestone ticks, **+ Log** / Set goal buttons, expandable history (bar chart rows, PB rows gold)
- Modals: log (weight/reps), goal (target weight)

## 14. Goals ✅
1. Title
2. Goal cards (max 3): type badge (KM/ELEV/GYM), activity filter, period, progress bar with 25/50/75 checkpoints, "N / target", encouraging sub-line, delete ✕, completion celebration state
3. **+ Add Goal** → modal: type, activity, target, period (week/month/custom date)

## 15. Plan
1. Title ("Plan Your Week")
2. Summary: Earned so far · Planned (+N) · Projected — 3 columns
3. Planned workout rows (icon, duration, projected Effort, remove)
4. **+ Add** → modal: type chips, sessions/duration stepper, running "added so far" list
5. Team impact: per team, projected rank change (P4 → P2 ↑) + mini top-5 leaderboard with your row highlighted

## 16. Races
1. Title + Find (directory) + **+ Add** buttons
2. Tabs: Mine / Friends / Completed
3. Race cards: type badge, name, location · distance · date, big countdown ("38 days to go"), goal time, training-load bar (weekly avg vs race distance), discipline chips (tri/HYROX), "I'm in" + interest count on friends' races, Register → link
4. Completed cards: ✓ badge, goal vs actual time, supportive message, "+ Log your finish time"
- Modals: add/edit race (supports Triathlon/HYROX/CrossFit/custom disciplines), find-a-race directory, log finish time

## 17. Ranks
1. Title + "Start as a Rookie. Become Unrivaled."
2. Vertical ladder: level icon + name + Effort range per rung, connector line, YOU badge on current, locked padlocks above
3. Footer line: "Everyone has a Rival. Only a few become Unrivaled."

## 18. Achievements
1. Title + "N of M unlocked"
2. "New unlocks!" banner when fresh
3. 6 category sections, 3-per-row badge grid: icon, name, description; locked = grey + padlock, new = gold border

## 19. Recap (Monthly / Year Wrap-up)
1. Hero: period title + Time Earned with trend vs last period
2. Stats grid: workouts · Effort · km · m climbed (each with trend)
3. Top sport highlight
4. Best week highlight (yearly)
5. Closing message (calm, encouraging)

## 20. AI Share ✅
1. Photo preview (activity photo or upload) + photo strip
2. Style carousel: Cinematic / Cyberpunk / Vintage Poster / Comic / Watercolour / Champion / Fantasy / Anime / Cherry Blossom / Surprise Me
3. Caption input · lift picker (strength) · race-countdown chips (opt-in)
4. **Generate** (loading theatre state)
5. Result: full card preview, Download, Roll Again
6. Quota line: "N generations left today"

## 21. Friends
1. Search bar (name or email)
2. Result rows with Follow / Following button
3. Following list ranked by this-week Effort (rank #, name, score)

---

### Notes for Stitch
- "Workout Detail" (in your canvas) is a NEW page — the app currently has no dedicated activity detail screen. Nice addition; if you keep it, it needs: hero photo (+ no-photo variant), name, stats row, route map, exercise list, Respect/Inspired row, comments.
- Design once, reuse everywhere: activity card, leaderboard row (rank/avatar/name/Effort/trend), stat tile, progress bar with milestone ticks, chip group, modal sheet, empty state.
- Every list needs: loading / empty / populated / error.
