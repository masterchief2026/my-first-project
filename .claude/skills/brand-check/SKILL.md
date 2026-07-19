---
name: brand-check
description: Gate user-facing copy (UI strings, notifications, quotes, empty states, marketing lines) against RIVAL's brand-voice bible. Use before shipping any new user-visible text, or to audit existing copy passed as an argument or found in the current diff.
---

# RIVAL Brand Check

Audit the copy given in the arguments (or all new/changed user-facing strings in the current working diff if no argument) against RIVAL's brand voice. Report each line as **PASS** or **FLAG** with a one-line reason and, for flags, a suggested rewrite in-voice.

## The voice

Calm, confident, thoughtful, optimistic. Speaks like the training partner everyone wishes they had. Never loud, never shames, never fake-hustle. **Consistency — not motivation — is the outcome RIVAL builds for**; copy serves that.

## Hard rules

- **Words we avoid (automatic FLAG):** grind, hustle, beast mode, crush, destroy, dominate, no excuses, "pain is weakness", "winners never quit", "rise and grind" — and anything in that register.
- **Words we like:** effort, consistency, identity, community, progress, momentum, journey, future, today, encourage, inspire, become, together, show up.
- **No guilt or pressure mechanics in copy**: nothing that shames a missed day/week ("don't break your streak!" energy is out). Streaks are pure consistency info, never a threatened loss.
- **Vocabulary**: user-facing copy says **Team** (never league/group), **Effort** (never XP/points), **Respect** and **Inspired** (reactions), **Impact**, **Unrivaled** (top rank). These are display-copy rules only — never rename code identifiers, DB columns, or routes to match.

## Quality bar for each line

Short, clear, memorable; no clichés or motivational-poster language; makes the reader think, reflect, or feel seen; direct address ("you") is fine; timeless (still true in 5+ years); no negativity; human, not robotic.

## Output

A table or tight list: line → PASS/FLAG → reason → (if FLAG) rewrite. End with an overall verdict and anything structural (e.g. a whole feature whose framing fights the ethos, not just its words).
