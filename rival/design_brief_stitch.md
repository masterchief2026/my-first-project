# RIVAL — Layout Design Brief (for Google Stitch)

## What RIVAL is
A social fitness app. Friends form small private (or discoverable-public) **Teams**, log workouts (manually, via photo scan, or Strava sync), earn **Effort** points, and compete on a weekly leaderboard. Social layer: reactions (**Respect** / **Inspired**), comments, chat, challenges, shared race goals ("Journeys"), and AI-generated shareable workout cards.

**Brand vocabulary — use these exact words in the UI, not generic fitness-app terms:**
- **Team** (not "league" or "group")
- **Effort** (not "XP" or "points") — the scoring currency
- **Respect** — everyday reaction (like a "nice one")
- **Inspired** — rare, meaningful reaction (feeds a person's **Impact** stat)
- **Impact** — how many people someone's effort has moved
- Rank ladder: Rookie → ... → **Unrivaled** (top rank)
- Tone: calm, confident, encouraging — never shouting, never guilt/pressure language (no "don't break your streak!" energy)

Color palette is already locked from the previous Stitch pass — this brief is for **page layout only**.

---

## Navigation structure
Full-screen stack navigation (not a persistent tab bar). Core loop:
**Home → Team → Feed/Chat/Sessions/Challenges tabs**, with Profile, My Activities, Races, Goals, Ranks, Friends, AI Share reachable from Home's header or from within screens.

Primary entry points from Home's header: **Plan · Goals · Races · Achievements · Friends**, plus a profile avatar.

---

## Screens

### 1. Home (Dashboard) — the most important screen
- Header: logo + icon nav (Plan / Goals / Races / Achievements / Friends) + avatar
- Greeting ("Hey, [Name]")
- 3 stat tiles: **Streak** · **Level** (with mini Effort progress bar) · **Days to next race**
- "+ Add Workout" primary button
- "AI Share" promo banner (turn last activity into a share card)
- Season countdown banner (last 30 days of the year)
- Hero "Time Earned" card (big number: hours + minutes trained)
- Lifetime stats grid: Lifetime Effort / Activities / km / m climbed
- "By activity type" card grid (icon + type + distance/sessions)
- "Personal bests" card grid, with "See all"
- Strava connect CTA / connected-status card
- "Your Teams" section: team cards (logo, name, "🔥 X new" badge) or empty state
- Buttons: **+ Create team / Join / 🔍 Discover**

### 2. Team Page (League) — tabbed hub
- Header: back, team name, invite code + copy button, "Edit Settings" (admin only)
- **Tabs: Feed / Chat / Sessions / Challenges**
- **Standings** block (always visible or its own tab): ranked member list, this week's Effort, rank-change trend arrow, MVP badge for last week's top scorer
- **Feed tab**: activity posts (athlete, type, duration/distance, Effort earned), race-announcement posts, photo/video gallery per post, **Respect / Inspired** reaction buttons + counts, expandable comments
- **Chat tab**: message list, @mention autocomplete, session-invite posts (RSVP + attendee list), input bar
- **Sessions tab**: Upcoming/History toggle, planned-session cards (type, time, location, RSVPs), "Quick Train" button, session-composer modal
- **Challenges tab**: 1v1 challenges (progress bars, accept/decline), team-vs-team challenges, "Challenge [member]" buttons, metric + duration picker

### 3. Team Settings (admin only)
- Logo upload, editable team name, Private/Public visibility toggle
- **Join Requests** list with Approve/Decline (when public)
- Members list: role badge, Make/Remove Admin, Remove member

### 4. Create Team
- Name input, Private toggle, optional "attach a race" (turns it into a **Journey**) radio list, Create button

### 5. Join Team (by code)
- Large invite-code input, Join button

### 6. Discover Teams
- Search bar, public team cards (logo, name, member count), **Request to join** / **Requested** / **View** button states, empty state

### 7. Ranks
- Vertical ladder list: level icon, rank name, Effort range, "YOU" marker, locked/unlocked states, connecting line

### 8. Profile
- Avatar + editable display name/username, lifetime training time
- Hero rank card: rank icon/name, level + Effort badge, season countdown, progress bar to next level ("Unrivaled" special state at max)
- Stat tiles: this week Effort / lifetime Effort / activities / km / m climbed / member-since
- Hero "Time Earned" card
- **Streak card**: current streak, 2/4/8/12-week tier ladder (checkmarks), plain consistency framing — **no bonus/multiplier language, no penalty framing**
- **Milestones card**: 100h/500h/1,000h/5,000h badges, locked vs unlocked
- **Impact card**: "X times people have shown up for your effort" + count of people
- Past seasons list
- Settings: Display-style picker (3 options), Daily motivation tone picker (Blunt/Balanced/Encouraging) with live preview
- Quick links: Ranks / Achievements / Monthly Recap / Year Wrap-up
- Strava connection status + import/disconnect actions
- Sign out

### 9. Friends
- Search bar, Follow/Following buttons, "Following" list ranked by this week's Effort

### 10. Goals
- Goal cards (type badge: distance/elevation/gym sessions, progress bar with 25/50/75% checkpoints, completion celebration state), max 3 goals, "+ Add Goal" modal

### 11. Plan (Week Planning)
- Effort summary: earned so far / planned / projected (3-column)
- Planned workouts list (add/remove)
- "Team impact" projection: mini leaderboard per team showing rank-change if planned workouts are logged
- Add-workout modal with activity type chips + sessions/duration input

### 12. Races
- Tabs: Mine / Friends / Completed
- Race cards: type icon, name, location/distance/date, countdown ("X days to go"), goal time, training-load indicator, "I'm in" + interest count (friends' races), log-finish-time flow
- Add/Edit Race modal (supports Triathlon, HYROX, CrossFit, custom multi-discipline races)
- "Find a Race" directory modal with type filters

### 13. My Activities
- Filter/sort bar (type filter, latest/oldest, PR toggle)
- Weekly grouped sections, each activity card: icon, editable name, multiplier badge, PR badge, Effort score, photo/edit/AI-share action icons, exercise breakdown for lifts, media gallery

### 14. Scan Workout
- Photo/gallery picker → extracted-workout preview form: type chips, duration/distance/elevation, date, notes, exercise list with lift-tagging, add more media, Save

### 15. Weekly Scan
- 7-day grid picker (Mon–Sun) to attach photos per day, batch "Scan & Save All", per-day result rows (pending/scanning/saved/error) with inline rename

### 16. Lifts
- Per-lift cards: PB summary, progress bar to goal with milestone ticks, Log/Set-goal buttons, expandable history (bar chart per entry, PB entries gold)

### 17. AI Share
- Photo preview (activity photo or custom upload)
- Style carousel: Cinematic / Cyberpunk / Vintage Poster / Comic / Watercolour / Champion / Fantasy / Anime / Cherry Blossom / Surprise Me
- Optional caption input, lift picker, race-countdown chip picker
- Generate button → loading state → result preview with Download / Roll Again
- Daily quota indicator ("X generations left today")

### 18. Recap (Monthly / Year Wrap-up)
- Hero time-earned card with trend vs last period
- Stats grid: workouts / Effort / km / m climbed, each with trend
- "Top sport" highlight, "Best week" highlight (yearly)
- Motivational closing message

### 19. Achievements
- Unlock counter, "new unlocks" banner
- 6 category sections, 3-per-row badge grid, locked (grey + lock icon) vs unlocked (gold border) states

### 20. Auth (Welcome / Sign In / Sign Up / Reset Password)
- Welcome: logo, tagline, Get Started + Sign In buttons
- Sign In: email/username + password, remember-me, forgot-password link, error/success states
- Sign Up: display name + email + password
- Reset Password: token-based new-password form

---

## Design-system notes for Stitch
- Needs consistent primitives: **primary button**, **outlined/secondary button**, **destructive (red) action**, **icon-only action button**, **chip/toggle group**, **progress bar with milestone ticks** (reused on Goals, Lifts, Plan, Profile streak/level), **empty state pattern** (icon + line + subtext), **modal/sheet pattern** (used constantly — add/edit forms across Races, Goals, Lifts, Sessions, Create Team).
- Recurring components to design once, reuse everywhere: **activity card**, **member/leaderboard row w/ rank + trend arrow**, **reaction button pair (Respect/Inspired)**, **stat tile**, **hero stat card**.
- States to design for every list: loading, empty, populated, error.
