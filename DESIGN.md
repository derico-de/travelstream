---
name: Travelstream
description: Calm, offline-first travel capture PWA — a field journal that becomes a blog
colors:
  harbor-teal: "#0e5f6d"
  shallow-harbor: "#2f7f8d"
  harbor-mist: "#e1eef0"
  harbor-mist-hover: "#ecf3f4"
  harbor-mist-pressed: "#d4e5e8"
  ink: "#1c2430"
  slate: "#5a6676"
  teal-slate: "#42555b"
  overcast: "#f5f6f8"
  page-white: "#ffffff"
  control-border: "#b8c0cc"
  hairline: "#dbe1e8"
  signal-red: "#b3261e"
  trail-green: "#14691b"
  warning-sand: "#fdf3e3"
  warning-edge: "#e8c98a"
  ember: "#e0703c"
  darkroom: "#10151c"
  shadow-tint: "rgba(20, 30, 40, 0.12)"
typography:
  title:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
  headline:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.3
  nav-label:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.2
  nav-icon:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "1.3rem"
    lineHeight: 1
  tile-icon:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    lineHeight: 1
rounded:
  control: "6px"
  surface: "8px"
  tile: "10px"
  sheet: "12px"
  pill: "999px"
spacing:
  xs: "0.3rem"
  sm: "0.6rem"
  md: "1rem"
  lg: "1.4rem"
components:
  button-primary:
    backgroundColor: "{colors.harbor-teal}"
    textColor: "{colors.page-white}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.page-white}"
    rounded: "{rounded.surface}"
    padding: "0.35rem 0.75rem"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.teal-slate}"
    rounded: "{rounded.tile}"
    typography: "{typography.nav-label}"
  nav-item-active:
    backgroundColor: "{colors.harbor-mist}"
    textColor: "{colors.harbor-teal}"
    rounded: "{rounded.tile}"
    typography: "{typography.nav-label}"
  capture-tile:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "1.4rem 0"
  input:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.5rem"
  card:
    backgroundColor: "{colors.page-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "0.7rem 0.9rem"
---

# Design System: Travelstream

## 1. Overview

**Creative North Star: "The Field Journal"**

Travelstream looks like a sturdy notebook carried on the road: a quiet cover, unhurried pages, and the traveller's own photos, places, and dates as the only ornament. The chrome is the binding — small, petrol-accented, and deliberately unremarkable — while the entries are the point. Density is low; one column, generous whitespace, nothing competing for attention with a photograph. Motion exists only to confirm state (a tap registered, an upload progressing) and never to perform.

The system explicitly rejects the three anti-references from PRODUCT.md: no social-feed mechanics or engagement bait, no dense toolbar-heavy enterprise-admin feel, and no SaaS marketing gloss — no gradients-as-decoration, no celebration confetti, no growth popups. It is a personal tool that disappears behind the trip.

**Key Characteristics:**
- Single centered column (max 46rem) on a cool-gray page; white surfaces resting on it with one soft shadow.
- One brand hue (Harbor Teal) carrying every interactive accent; content supplies all other color.
- System font stack throughout — journal entries, not typographic display.
- Thumb-first: sticky bottom navigation, ≥44px touch targets, primary actions in reach of one hand.
- Offline is a designed state, not an error state.

## 2. Colors

A restrained cool palette: one deep teal voice over gray-and-white paper, with small semantic signals.

### Primary
- **Harbor Teal** (#0e5f6d): the single brand voice — top bar, primary buttons, active navigation, focus rings, map photo-markers, links-as-actions. White text on it passes AA at 7.3:1.
- **Shallow Harbor** (#2f7f8d): the lighter gradient partner and hover companion to Harbor Teal; never used for text.
- **Harbor Mist** (#e1eef0): the active-state pill behind the current nav item and any selected-state fill. **Harbor Mist Hover** (#ecf3f4) and **Harbor Mist Pressed** (#d4e5e8) are its interaction neighbors.

### Secondary
- **Ember** (#e0703c): map markers for non-photo entries only. A deliberate, tiny counterpoint to Harbor Teal — never a UI accent, never on buttons.

### Neutral
- **Ink** (#1c2430): all body text.
- **Slate** (#5a6676): secondary text — timestamps, state labels, kind tags. **Teal-Slate** (#42555b) is its petrol-tinted sibling for inactive nav labels.
- **Overcast** (#f5f6f8): the page background — cool gray, never warm.
- **Page White** (#ffffff): every raised surface (cards, tiles, the bottom nav bar).
- **Control Border** (#b8c0cc): strokes on inputs and buttons. **Hairline** (#dbe1e8): dividers and the bottom nav's top edge.
- **Darkroom** (#10151c): the media viewing stage behind full photos and video, with rgba(10, 16, 24, 0.55) as the modal backdrop.

### Semantic
- **Signal Red** (#b3261e): failures and destructive actions only.
- **Trail Green** (#14691b): success confirmations ("queued", "✓ uploaded").
- **Warning Sand** (#fdf3e3) with **Warning Edge** (#e8c98a): the storage-eviction warning panel — the one warm surface in the system, earned by genuinely warning.

### Named Rules
**The One Voice Rule.** Harbor Teal is the only color that may signal interactivity. If a second accent seems needed, the screen is doing too much.

**The Content Owns Color Rule.** Photos and the map supply the vivid color; the UI stays in the teal-gray family. Never tint a surface for decoration.

## 3. Typography

**Display Font:** system-ui (with -apple-system, sans-serif)
**Body Font:** system-ui — one family, multiple weights

**Character:** Plain, native, journal-like. The device's own typeface makes the app feel like part of the phone — a tool, not a brand exercise. Hierarchy comes from weight and size, never from a second family.

### Hierarchy
- **Title** (700, 2rem, 1.2): one per screen — "Capture", "Trips", "Outbox".
- **Headline** (700, 1.5rem, 1.25): section headings within a screen ("Note").
- **Body** (400, 1rem, 1.5): entry text, form values, prose. Cap prose at 65–75ch.
- **Label** (400, 0.85rem): state labels, timestamps, helper text — always in Slate on white.
- **Nav Label** (400→600 active, 0.72rem): bottom navigation captions beneath icons.

### Named Rules
**The Native Type Rule.** No webfonts, ever. The system stack is a feature (fast, offline, familiar), not a placeholder.

## 4. Elevation

One soft shadow is the entire depth system: `box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12)`. White surfaces rest on the Overcast page like photos laid on a desk — present, but never floating dramatically. The sticky top and bottom bars separate by color and hairline, not shadow. Modal layers (the timeline picker) use the rgba(10, 16, 24, 0.55) backdrop plus the same quiet shadow at sheet radius.

### Shadow Vocabulary
- **Resting surface** (`box-shadow: 0 1px 3px rgba(20, 30, 40, 0.12)`): cards, tiles, outbox items — anything white on Overcast.

### Named Rules
**The Laid-Flat Rule.** Nothing lifts on hover. Interaction feedback is a fill change (Harbor Mist family), never a shadow change. If an element looks like it's flying, it's wrong.

## 5. Components

Soft and journal-like: gentle radii, tinted fills for states, solid Harbor Teal reserved for the one primary action a screen offers.

### Buttons
- **Shape:** gently rounded (6px controls; 8px+ for standalone actions).
- **Primary:** solid Harbor Teal fill, white text, 0.5rem × 1rem padding. One per screen ("Queue note", "+ New trip").
- **Outline (on teal):** transparent with a 1px rgba(255,255,255,0.45) border and white text — the top-bar "Log out".
- **Ghost/secondary (on white):** white fill, Control Border stroke, Ink text — outbox "Retry"/"Delete", with Signal Red text for destructive.
- **Hover / Focus:** background shifts within the Harbor Mist family (150ms ease-out); focus is a 2px Harbor Teal `focus-visible` outline. Reduced motion: transitions off.

### Chips
- **Style:** pill-shaped (999px) filter toggles on the trip timeline; Harbor Mist fill when selected, hairline-bordered white when not.

### Cards / Containers
- **Corner Style:** 8px (list items), 10px (tiles), 12px (sheets/modals).
- **Background:** Page White on Overcast, always.
- **Shadow Strategy:** the single resting shadow (see Elevation); never stacked, never nested cards.
- **Internal Padding:** 0.7rem × 0.9rem list items; 1.4rem-tall capture tiles.

### Inputs / Fields
- **Style:** white fill, 1px Control Border stroke, 6px radius, 0.5rem padding, Body type.
- **Focus:** browser-native focus ring is acceptable; where styled, the 2px Harbor Teal outline.
- **Error:** message text in Signal Red beneath the field — no red borders shouting.

### Navigation
- **Top bar:** Harbor Teal band with the white brand wordmark and the outline Log out button. Scrolls away with the page — it is cover, not chrome.
- **Bottom bar (signature):** sticky, Page White with a Hairline top edge, safe-area padded. Four icon+label buttons sharing the row equally, ≥48px tall. Active route: Harbor Mist pill, Harbor Teal text, weight 600. Inactive: Teal-Slate. This bar is the app's thumb-first backbone; nothing else may claim the screen's bottom edge.

### Capture Tiles (signature)
Large white 10px-radius tiles ("📸 Photo", "🎬 Video") that are actually file inputs — the biggest touch targets in the app, because capture never waits. Each tile stacks a 1.5rem icon (`tile-icon`) over a 600-weight label so the primary action wins the squint test without needing a fill. The tile group is **bottom-anchored** (`margin-top: auto` in a screen-filling column): it rests in the thumb arc just above the bottom nav, camera-shutter style, and conditional content (storage warning, camera-roll button) inserts above it inside the anchored zone so the tiles never shift after load. Status feedback (`.flash`) sits directly below the tiles, where the eye already is.

### Spacing discipline
Between-group seams come from the scale: `lg` (1.4rem) separates major groups, `md` (1rem) separates a warning from the actions it modifies, `sm`/`xs` live inside groups. Headings carry authored margins (`h1: 0 0 1rem`), never UA defaults. Accepted micro-exceptions below the scale: chrome-internal paddings (top bar 0.35rem, nav gaps 0.1–0.25rem, outline-button 0.35rem × 0.75rem) — fine-tuning inside fixed-height bars, not layout seams.

## 6. Do's and Don'ts

### Do:
- **Do** keep Harbor Teal (#0e5f6d) as the only interactive accent; express states through the Harbor Mist family (#e1eef0 / #ecf3f4 / #d4e5e8).
- **Do** hold every touch target at ≥44px and keep primary actions inside one-handed thumb reach.
- **Do** give every animation a `prefers-reduced-motion: reduce` alternative; 150–250ms ease-out is the house tempo.
- **Do** treat offline as a first-class state: show queue status plainly, in Slate and Trail Green, never as an alarm.
- **Do** let photos and the map be the color; keep chrome in the teal-gray family.

### Don't:
- **Don't** import a webfont — the system stack is doctrine (The Native Type Rule).
- **Don't** build social-media-feed patterns: no infinite scroll mechanics, likes, or engagement hooks (PRODUCT.md anti-reference).
- **Don't** drift toward enterprise-CMS density: no toolbar rows, no icon crowding — the Plone backoffice stays behind the curtain (PRODUCT.md anti-reference).
- **Don't** add SaaS-marketing gloss: no decorative gradients, glassmorphism, hero metrics, or celebration animations (PRODUCT.md anti-reference).
- **Don't** use shadows for interaction feedback or stack elevations (The Laid-Flat Rule); one resting shadow only.
- **Don't** use Ember (#e0703c) outside map markers, and never as a button or link color.
- **Don't** warm the page background — Overcast (#f5f6f8) stays cool; the only warm surface allowed is the storage warning.
