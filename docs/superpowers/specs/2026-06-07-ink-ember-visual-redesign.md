# Aura "Ink & Ember" Visual Redesign

**Date:** 2026-06-07  
**Status:** Approved

## Summary

Replace the current glassmorphism-heavy dark navy UI with a warm, humanist dark design system ("Ink & Ember"). The current design feels dated (blue radial blobs, frosted glass panels, inset white highlights). The new direction is warm-dark with Nostr orange accents, solid surfaces, and a serif display face — crafted and opinionated rather than generic SaaS.

## Color System

```css
--bg: #0d0905;
--bg-2: #161008;
--surface: #1f160d;
--surface-2: #261c12;
--border: rgba(255, 180, 80, 0.10);

--text: #f5ede0;
--muted: #9e8a72;
--muted-2: #6b5a44;

--accent: #f97316;
--accent-warm: #fb923c;
--accent-ember: #ea580c;
--accent-gold: #f5c06e;
--danger: #f87171;
```

No teal. No indigo. No blue in the chrome. Cool tones appear only in loaded site content.

## Typography

- **Display/headings:** Fraunces (Google Fonts) — optical-size serif, warm, literary
- **UI/body:** DM Sans — humanist sans, not geometric-cold
- **Mono:** JetBrains Mono — for pubkeys, paths, addresses

Load via Google Fonts or bundle. Replace current Palatino/Segoe UI/SFMono stack.

## Background

Replace blue radial blob gradients with:
- Single warm radial: `radial-gradient(ellipse at 30% 0%, rgba(249, 115, 22, 0.12), transparent 50%)`
- Subtle SVG grain/noise texture overlay for "crafted" feel
- No CSS grid overlay

## What Gets Removed

- All `backdrop-filter: blur()` — gone
- All `rgba(255,255,255, 0.05)` glass fill layers — gone
- All radial blob gradients in component `::before` pseudo-elements — gone
- `--panel`, `--panel-strong` CSS variables — replaced by solid surfaces
- CSS grid texture overlay (the `::after` on `.aura-shell`) — gone
- Inset white highlight shadows — gone

## Shell Chrome

**Topbar:**
- Background: `#110c07` (solid, no blur)
- Bottom border: `rgba(249, 115, 22, 0.14)`
- No backdrop-filter

**Address bar:**
- Warm dark input: `#1a1108`
- Focus ring: `rgba(249, 115, 22, 0.35)` orange glow
- Go button: solid `--accent` orange

**Nav buttons:**
- Flat — border only, no gradient fills, no inset highlights
- Hover warms the border to orange

## Launch Card

- Solid warm dark surface `#1a1108`, border-radius `24px`
- Heading in Fraunces at large size
- No inner radial gradients, no pseudo-element atmosphere layers

## Integrated Chrome (Progressive Enhancement)

When a site is loaded, read its `theme-color` meta tag. Blend that color into:
- The topbar's accent border
- A faint background tint on the address bar input

Sites without `theme-color` get default orange. This makes the chrome feel aware of what it frames.

## Demo Site

Update `public/demo-site/styles.css` to harmonize with the new shell tokens — same warm dark base, same orange accent family.

## Scope

Files to modify:
- `src/shell/styles.css` — primary target, full rewrite of variables and component styles
- `public/demo-site/styles.css` — update to match new tokens
- `index.html` — add Google Fonts link for Fraunces + DM Sans
- Shell TSX component(s) — add theme-color reading logic for integrated chrome
