// Shared window-width breakpoints for responsive screens. Keep these as the
// single source of truth — don't inline new `windowWidth >= N` checks in
// screens; add a named constant here instead so every screen agrees on what
// counts as "wide".

// Sidebar / multi-column desktop-style layouts (profile, league, lifts, etc.)
export const BREAKPOINT_WIDE_LAYOUT = 840;

// Two-up card grid (discover-leagues, my-activities) — needs less room than
// a full sidebar layout, just enough for two cards side by side.
export const BREAKPOINT_TWO_UP_GRID = 760;

// Inline gallery placement next to the stat column in my-activities — only
// the widest cards have room for this without cramping.
export const BREAKPOINT_SPACIOUS_GALLERY = 900;

// Below this, RivalTopNav swaps its desktop link row for the floating
// bottom tab bar. Screens with their own fixed/floating elements (FABs, etc.)
// need this too, to know when to clear the bar's height.
export const BREAKPOINT_MOBILE_NAV = 640;
