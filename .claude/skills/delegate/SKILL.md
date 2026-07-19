---
name: delegate
description: Route a task to the cheapest model tier that can do it correctly, delegating well-scoped mechanical work to a subagent instead of burning the active (often pricier) model's quota. Use when the user hands you a task and effort/cost efficiency matters, or when asked to "delegate" or "route" work.
---

# Delegate

Claude Code can't switch the active conversation's model mid-session (that's the user's `/model` command) — but the Agent tool CAN spawn a subagent pinned to a specific model (`haiku`, `sonnet`, `opus`, `fable`) via its `model` parameter. This skill is the decision logic for when to do that instead of just doing the work directly in the active model.

## Step 1 — classify the task

**Mechanical / spec-following** (cheap-model territory — Haiku first choice, Sonnet if Haiku struggles):
- Batch find-and-replace, hex-color → token substitution, renames across files
- Applying an already-agreed style/layout to more screens once the pattern is proven on one
- Image/asset optimization, compression, format conversion
- Extracting duplicated code into a shared helper when the target shape is already decided
- Writing tests for already-specified behavior
- Anything with a clear "right answer" checkable by a linter/type-checker/test suite

**Judgment / design / novel reasoning** (stays with whatever model is currently driving — don't delegate):
- Layout decisions, comparing mockup vs. build and deciding what's "off"
- Product/concept decisions (what a card means, what data goes where)
- Architecture calls, anything where two competent engineers could reasonably disagree
- Debugging a genuinely unclear failure (not a known lint/type error)
- Anything the user is actively giving live feedback on (that's a conversation, not a delegation)

If a task is a mix, split it: do the judgment part yourself, delegate the mechanical remainder.

## Step 2 — delegate or do it directly

**Small (a few tool calls, done in under a minute either way):** just do it in the active model. Delegation overhead (spawning, re-deriving context) isn't worth it for trivial work.

**Substantial mechanical work** (touches many files, is long/repetitive, or is exactly the kind of batch job that doesn't need the active model's judgment): spawn an Agent with `model: "haiku"` (or `"sonnet"` if the task has enough ambiguity that Haiku is likely to need correction). Give it:
- The exact spec/pattern to follow (cite the file(s) that already show the target shape)
- What "done" looks like (tsc clean, tests pass, a specific visual match)
- Explicit instruction NOT to make judgment calls — if it hits an ambiguous case, stop and report back rather than guessing

## Step 3 — verify the delegated work yourself

Never trust a subagent's self-report. After it returns: run the type-checker/tests/lint yourself, and spot-check a sample of the actual diff. This is the same "trust but verify" rule that applies to all subagent work — cheaper models are more likely to leave inconsistencies, so the verification step matters more here, not less.

## Why this matters for this project specifically

RIVAL sessions have repeatedly hit rate-limit walls from doing large mechanical batch work (find-and-replace across screens, review-agent swarms) on the expensive/limited model. The pattern that's worked: judgment-heavy work (mockup-to-code comparison, concept decisions, architecture) on the strong model; mechanical batch work (style token substitution, image optimization, boilerplate screen scaffolding) delegated or done on Sonnet/Haiku. Keep doing that split.
