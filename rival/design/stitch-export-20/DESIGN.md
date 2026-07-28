---
name: Refined Ember
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#323232'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#dbc1b9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#a38c85'
  outline-variant: '#55433d'
  surface-tint: '#ffb59e'
  primary: '#ffb59e'
  on-primary: '#5c1902'
  primary-container: '#d97757'
  on-primary-container: '#541400'
  inverse-primary: '#99462a'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#5edac7'
  on-tertiary: '#003731'
  tertiary-container: '#09a493'
  on-tertiary-container: '#00312b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59e'
  on-primary-fixed: '#390b00'
  on-primary-fixed-variant: '#7a2f15'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#7df7e3'
  tertiary-fixed-dim: '#5edac7'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
  surface-low: '#131313'
  surface-mid: '#1C1C1C'
  surface-high: '#282828'
  text-primary: '#FFFFFF'
  text-secondary: '#A0A0A0'
  rank-rookie: '#B0B0B0'
  rank-pro: '#D97757'
  rank-elite: '#9F57D9'
  rank-unrivaled: '#FFD700'
  status-inspired: '#FFFFFF'
typography:
  display-hero:
    fontFamily: manrope
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: manrope
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  title-md:
    fontFamily: manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  metric-large:
    fontFamily: manrope
    fontSize: 32px
    fontWeight: '300'
    lineHeight: 32px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  stack-gap: 1rem
  section-margin: 2rem
  container-padding: 1.5rem
  gutter: 1rem
  max-width: 1200px
---

## Brand & Style
The design system is built on the principle of **Human Utility**, moving away from the "data-obsessed" fitness culture toward a "People Before Data" philosophy. The brand personality is encouraging, sophisticated, and human—balancing the grit of sport with the elegance of a premium lifestyle product.

The design style is **Minimalist with Tactile accents**. It uses heavy whitespace (or "dark space" in this context) and a limited color palette to maintain a premium feel. The interface feels "alive" through movement and human imagery rather than complex dashboards. We prioritize "Premium Restraint," meaning every pixel must earn its place to avoid overwhelming the user.

**Design Principles:**
- **People Before Data:** Faces and activities always take precedence over raw metrics.
- **Human Utility:** Every interaction should feel like a natural extension of a workout, not a secondary administrative task.
- **Premium Restraint:** Use whitespace and high-quality typography to convey value, not visual clutter.

## Colors
The palette is rooted in a deep charcoal foundation, providing a "canvas" for community content.

- **Primary Accent:** Soft Terracotta (#D97757). This is used for interactive elements, primary CTAs, and progress highlights. It is warm and motivating without being aggressive.
- **Surfaces:** Depth is achieved through a tiered charcoal system. 
    - `surface-low` (#131313) is the base background.
    - `surface-high` (#282828) is for elevated cards and sheets.
    - `surface-bright` (#323232) is used for subtle hover states or emphasized containers.
- **Ranks:** Visual progression is tracked through a semantic rank scale, moving from the neutral `Rookie` to the metallic glow of `Unrivaled`.
- **Interactive Tones:** `Respect` is the standard interactive state (Primary Terracotta), while `Inspired` (Bright White) represents premium impact or "peak" community actions.

## Typography
Manrope is used exclusively to maintain a clean, modern, and premium feel. 

- **Display & Narrative:** Large headlines are used to introduce human stories. For statistics, we use `metric-large` with a lighter weight (300) to ensure numbers feel elegant rather than intimidating.
- **Readability:** Body text is set with generous line-height to ensure ease of reading during or after physical activity.
- **Labels:** Use `label-caps` for secondary metadata and progress indicators to create clear visual hierarchy against the larger narrative type.

## Layout & Spacing
The layout follows a **Human Utility** model, prioritizing ease of reach and clarity of focus.

- **Stack Navigation:** Content is organized in vertical stacks with a consistent `stack-gap`. This mimics the natural scroll of social feeds while keeping data grouped logically.
- **Full-Screen Sheets:** For deep-dives or authenticated actions, we use full-screen sheets that slide over the current view. This maintains context while providing a focused environment for input.
- **Grid:** A 12-column grid is used for desktop, but the "Premium Restraint" principle dictates that content rarely spans the full width, often centered with generous `section-margin` to focus the eye.
- **Mobile First:** Given the utility nature, the layout is optimized for thumb-reach, with primary actions placed in the bottom 30% of the screen.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Subtle Shadows**. 

We avoid harsh shadows in favor of surface-container tiers. High-utility elements (like current workout cards) use `surface-high` to visually "pop" against the `surface-low` background. 

- **Backdrop Blurs:** When sheets or modals are active, the background is blurred to maintain focus on the "People" or "Activity" in the foreground.
- **Inner Glows:** For premium rank cards (Unrivaled), a very subtle inner glow using the brand-accent color is permitted to simulate a physical, metallic material.

## Shapes
The shape language is "Soft iOS-inspired." A base roundedness of **8px (0.5rem)** is applied to all standard containers and buttons. 

- **Standard Containers:** 8px.
- **Large Cards/Sheets:** 16px (1rem) to emphasize the "welcoming" nature of the community.
- **Interactive Elements:** Buttons and input fields follow the 8px standard for a consistent, professional hand-feel.

## Components
Consistent styling across components reinforces the "Refined Ember" aesthetic.

- **Buttons:**
    - **Respect (Standard):** Filled terracotta background (#D97757) with white text. 8px radius.
    - **Inspired (Premium):** White background with charcoal text. Used for high-impact milestones.
- **Progress Bars:** Specialized bars for Goals/Streaks. They use a secondary charcoal track with a terracotta fill. **Milestone Ticks** (1px vertical lines) are placed at intervals to mark community benchmarks.
- **Cards:** Use `surface-high` with 16px padding. Photography within cards should have a 4px inner radius to sit nested within the 8px container.
- **Input Fields:** Outlined style using `surface-bright` borders. On focus, the border transitions to the primary accent color.
- **Chips/Status:** Small, pill-shaped indicators for ranks. They use a low-opacity version of the rank color as a background with high-contrast text for legibility.
- **Full-Screen Sheets:** These transition from the bottom of the screen, featuring a "grabber" handle at the top to indicate draggability.