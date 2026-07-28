-- Reactions moved from emoji (🔥💪👏) to two words: Respect (everyday) and
-- Inspired (rare, feeds the Impact stat — unchanged). Folds the old casual
-- emoji taps into 'respect' so existing engagement isn't lost, rather than
-- leaving old rows pointing at values the UI no longer renders.

update feed_reactions
set emoji = 'respect'
where emoji in ('🔥', '💪', '👏', '🎉');
