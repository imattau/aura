# Ink & Ember Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Aura's glassmorphism dark-navy UI with the "Ink & Ember" warm-dark design system — Nostr orange accents, solid surfaces, humanist typography, no frosted glass.

**Architecture:** All visual changes are confined to `src/shell/styles.css` (shell chrome), `public/demo-site/styles.css` (demo site), and `index.html` (font loading). A small enhancement to `src/shell/App.tsx` reads the loaded site's `theme-color` meta tag to tint the topbar accent border. No logic changes elsewhere.

**Tech Stack:** Preact, Vite, plain CSS custom properties, Google Fonts (Fraunces + DM Sans + JetBrains Mono)

---

### Task 1: Load new fonts in index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add Google Fonts preconnect + stylesheet to `<head>`**

Replace the existing `<head>` block (currently has no font link) with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0d0905" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <title>Aura</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/shell/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Verify dev server picks up the change**

Run: `npm run dev`
Open browser to `http://localhost:5173` and open DevTools → Network. Filter by "fonts.googleapis" — you should see the font stylesheet request. No console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: load Fraunces, DM Sans, JetBrains Mono from Google Fonts"
```

---

### Task 2: Rewrite CSS custom properties and base styles

**Files:**
- Modify: `src/shell/styles.css` (lines 1–58 — `:root`, `html/body/app`, `body` background)

- [ ] **Step 1: Replace the `:root` block**

Replace lines 1–25 (the entire `:root { ... }` block) with:

```css
:root {
  color-scheme: dark;
  --bg: #0d0905;
  --bg-2: #161008;
  --surface: #1f160d;
  --surface-2: #261c12;
  --border: rgba(255, 180, 80, 0.10);
  --border-strong: rgba(255, 180, 80, 0.22);

  --text: #f5ede0;
  --muted: #9e8a72;
  --muted-2: #6b5a44;

  --accent: #f97316;
  --accent-warm: #fb923c;
  --accent-ember: #ea580c;
  --accent-gold: #f5c06e;
  --danger: #f87171;

  --shadow: 0 24px 72px rgba(0, 0, 0, 0.55), 0 2px 0 rgba(255, 180, 80, 0.04) inset;

  --font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Fraunces", "Iowan Old Style", Georgia, ui-serif, serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", ui-monospace, monospace;
  font-family: var(--font-sans);
}
```

- [ ] **Step 2: Replace the `body` background block**

Replace the `body { ... }` rule (lines 36–53) with:

```css
body {
  overflow: hidden;
  background:
    radial-gradient(ellipse at 30% 0%, rgba(249, 115, 22, 0.12), transparent 50%),
    radial-gradient(ellipse at 80% 90%, rgba(234, 88, 12, 0.06), transparent 40%),
    linear-gradient(180deg, #110c07 0%, var(--bg) 60%, var(--bg-2) 100%);
  color: var(--text);
}
```

- [ ] **Step 3: Remove the `--panel` / `--panel-strong` variable references (they no longer exist)**

Search the file for `var(--panel)` and `var(--panel-strong)` — replace any occurrences with `var(--surface)` and `var(--surface-2)` respectively.

- [ ] **Step 4: Commit**

```bash
git add src/shell/styles.css
git commit -m "feat(ink-ember): new color tokens and warm background"
```

---

### Task 3: Rewrite shell structure — remove glass, add grain

**Files:**
- Modify: `src/shell/styles.css` (`.aura-shell`, `.aura-shell::before`, `.aura-shell::after`)

- [ ] **Step 1: Replace the `.aura-shell` and its pseudo-elements**

Find and replace the `.aura-shell`, `.aura-shell::before`, and `.aura-shell::after` rules with:

```css
.aura-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  color: var(--text);
  isolation: isolate;
}

/* Grain texture overlay — gives "crafted" feel */
.aura-shell::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}

/* No grid overlay — removed */
.aura-shell::after {
  display: none;
}
```

- [ ] **Step 2: Check visually**

Run `npm run dev`, open the browser. The home screen background should look warm brown-black with a very faint noise texture. No blue blobs, no grid lines.

- [ ] **Step 3: Commit**

```bash
git add src/shell/styles.css
git commit -m "feat(ink-ember): replace glass shell with solid warm surfaces + grain"
```

---

### Task 4: Rewrite the topbar

**Files:**
- Modify: `src/shell/styles.css` (`.aura-topbar` and related rules)

- [ ] **Step 1: Replace `.aura-topbar`**

```css
.aura-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  padding: 0.42rem 0.75rem;
  border: 0;
  border-bottom: 1px solid rgba(249, 115, 22, 0.18);
  border-radius: 0;
  background: #110c07;
  box-shadow: 0 1px 0 rgba(249, 115, 22, 0.06);
}
```

Note: no `backdrop-filter`, no gradient fill, no `rgba(255,255,255,...)` layers.

- [ ] **Step 2: Update nav button styles**

Replace the `.nav-controls button` rule with:

```css
.nav-controls button {
  border: 1px solid rgba(255, 180, 80, 0.14);
  background: transparent;
  color: var(--text);
  border-radius: 999px;
  padding: 0.72rem 0.82rem;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease, transform 140ms ease;
}
```

Replace the long hover/focus selector block with:

```css
.nav-controls button:not(:disabled):hover,
.nav-controls button:not(:disabled):focus-visible,
.address-bar button:not(:disabled):hover,
.address-bar button:not(:disabled):focus-visible,
.auth-actions button:not(.ghost):hover,
.auth-actions button:not(.ghost):focus-visible,
.auth-choice:hover,
.auth-choice:focus-visible,
.recent-site:hover,
.recent-site:focus-visible,
.topbar-demo-button:hover,
.topbar-demo-button:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(249, 115, 22, 0.55);
  box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.12) inset;
}
```

- [ ] **Step 3: Update `.topbar-demo-button`**

```css
.topbar-demo-button {
  border: 1px solid rgba(255, 180, 80, 0.14);
  background: transparent;
  color: var(--text);
  border-radius: 999px;
  padding: 0.5rem 0.85rem;
  cursor: pointer;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/shell/styles.css
git commit -m "feat(ink-ember): solid warm topbar, flat nav buttons"
```

---

### Task 5: Rewrite address bar and brand

**Files:**
- Modify: `src/shell/styles.css` (`.address-bar`, `.aura-brand`, `.aura-kicker`, `.aura-tagline`)

- [ ] **Step 1: Update address bar input**

```css
.address-bar input {
  flex: 1;
  min-width: 0;
  border: 1px solid rgba(255, 180, 80, 0.14);
  background: #1a1108;
  color: var(--text);
  border-radius: 999px;
  padding: 0.48rem 0.8rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

.address-bar input::placeholder {
  color: var(--muted-2);
}

.address-bar input:focus-visible,
.auth-card input:focus-visible {
  outline: none;
  border-color: rgba(249, 115, 22, 0.6);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.14), inset 0 1px 2px rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 2: Update address bar go button**

```css
.address-bar button,
.auth-actions button {
  background: var(--accent);
  color: white;
  box-shadow: 0 8px 20px rgba(249, 115, 22, 0.28);
}
```

- [ ] **Step 3: Update brand kicker and tagline**

```css
.aura-kicker {
  font-size: 0.64rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-gold);
  font-family: var(--font-mono);
}

.aura-tagline {
  color: var(--muted);
  font-size: 0.7rem;
  letter-spacing: 0.02em;
}

.aura-shell--standalone .aura-tagline {
  color: var(--accent-gold);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/shell/styles.css
git commit -m "feat(ink-ember): orange address bar focus, warm brand colors"
```

---

### Task 6: Rewrite launch card

**Files:**
- Modify: `src/shell/styles.css` (`.launch-card`, `.launch-card::before`, `.launch-rail-card`, `.recent-site`)

- [ ] **Step 1: Replace `.launch-card` and remove its `::before`**

```css
.launch-card {
  width: min(100%, 72rem);
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(18rem, 0.75fr);
  gap: 1rem;
  border: 1px solid var(--border);
  background: #1a1108;
  border-radius: 24px;
  padding: clamp(1.25rem, 3vw, 2rem);
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
}

.launch-card::before {
  display: none;
}
```

- [ ] **Step 2: Update heading font in `.launch-card h1`**

```css
.launch-card h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 4.6vw, 3.7rem);
  line-height: 0.94;
  letter-spacing: -0.03em;
  text-wrap: balance;
  font-weight: 600;
}
```

- [ ] **Step 3: Update `.launch-rail-card`**

```css
.launch-rail-card {
  display: grid;
  gap: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 0.95rem 1rem;
  background: var(--surface-2);
}
```

- [ ] **Step 4: Update `.launch-rail-label`**

```css
.launch-rail-label {
  color: var(--accent-gold);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.7rem;
  font-family: var(--font-mono);
}
```

- [ ] **Step 5: Update `.recent-site`**

```css
.recent-site {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 1rem 1rem 0.95rem;
  background: var(--surface);
  color: var(--text);
  text-align: left;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
  cursor: pointer;
  transition: border-color 140ms ease, transform 140ms ease;
}

.recent-site:hover {
  border-color: rgba(249, 115, 22, 0.4);
  transform: translateY(-1px);
  background: var(--surface-2);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/shell/styles.css
git commit -m "feat(ink-ember): solid warm launch card, orange hover accents"
```

---

### Task 7: Rewrite auth modal and card

**Files:**
- Modify: `src/shell/styles.css` (`.auth-modal`, `.auth-card`, `.auth-rail`, `.auth-choice`, `.auth-actions`)

- [ ] **Step 1: Replace `.auth-modal`**

```css
.auth-modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(8, 5, 2, 0.82);
  backdrop-filter: blur(12px);
  z-index: 30;
  border: 0;
  margin: 0;
}

.auth-modal::backdrop {
  background: transparent;
}
```

- [ ] **Step 2: Replace `.auth-card`**

```css
.auth-card {
  width: min(100%, 34rem);
  border: 1px solid var(--border);
  background: #1a1108;
  color: var(--text);
  border-radius: 24px;
  padding: 1.1rem;
  box-shadow: var(--shadow);
}
```

- [ ] **Step 3: Replace `.auth-rail`**

```css
.auth-rail {
  display: grid;
  gap: 0.95rem;
  align-content: start;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
}

.auth-rail h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.9rem;
  line-height: 1;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
```

- [ ] **Step 4: Replace `.auth-choice`**

```css
.auth-choice {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-start;
  text-align: left;
  padding: 1rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 18px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: border-color 140ms ease, transform 140ms ease;
}
```

- [ ] **Step 5: Replace `.auth-actions` button styles**

```css
.auth-actions button:not(.ghost) {
  background: var(--accent);
  color: white;
  box-shadow: 0 10px 24px rgba(249, 115, 22, 0.28), inset 0 1px 0 rgba(255,255,255,0.1);
}

.auth-actions .ghost {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  box-shadow: none;
}
```

- [ ] **Step 6: Update `.auth-card input`**

```css
.auth-card input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(255, 180, 80, 0.14);
  background: #110c07;
  color: var(--text);
  border-radius: 14px;
  padding: 0.9rem 1rem;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 7: Update eyebrow / kicker colors**

Replace all instances of `color: var(--accent-2)` in `.auth-eyebrow`, `.auth-mode-kicker`, `.auth-rail-label`, `.launch-rail-label`, `.search-hero-meta`, `.search-result-kind` with `color: var(--accent-gold)`.

- [ ] **Step 8: Commit**

```bash
git add src/shell/styles.css
git commit -m "feat(ink-ember): warm auth modal, solid card surfaces, orange CTA"
```

---

### Task 8: Rewrite search page styles

**Files:**
- Modify: `src/shell/styles.css` (`.search-*` rules)

- [ ] **Step 1: Update search result link hover**

```css
.search-result-link:hover {
  color: var(--accent-warm);
}

.search-result-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
  border-radius: 8px;
}
```

- [ ] **Step 2: Update search filter active state**

```css
.search-filter.is-active {
  color: var(--text);
  border-color: rgba(249, 115, 22, 0.44);
  background: rgba(249, 115, 22, 0.12);
}

.search-filter:hover,
.search-filter:focus-visible {
  color: var(--text);
  border-color: rgba(249, 115, 22, 0.44);
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.12);
}
```

- [ ] **Step 3: Update search result action button**

```css
.search-result-action--open {
  color: var(--text);
  border-color: rgba(249, 115, 22, 0.35);
  background: rgba(249, 115, 22, 0.14);
}

.search-result-action:hover,
.search-result-action:focus-visible {
  color: var(--text);
  border-color: rgba(249, 115, 22, 0.55);
  background: rgba(249, 115, 22, 0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px rgba(0,0,0,0.22);
}
```

- [ ] **Step 4: Update `.search-result-open`**

```css
.search-result-open {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 0;
  background: none;
  color: var(--accent-warm);
  padding: 0;
  cursor: pointer;
  font: inherit;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.search-result-open:hover {
  color: var(--accent-gold);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/shell/styles.css
git commit -m "feat(ink-ember): orange search accents and filter states"
```

---

### Task 9: Integrated chrome — theme-color tinting

**Files:**
- Modify: `src/shell/App.tsx`
- Modify: `src/shell/styles.css`

- [ ] **Step 1: Add `themeColor` state to `App.tsx`**

After the `reloadNonce` useState line, add:

```tsx
const [themeColor, setThemeColor] = useState<string | null>(null);
```

- [ ] **Step 2: Add a message handler for theme-color from the iframe**

After the `handleBlockPubkey` function, add:

```tsx
useEffect(() => {
  function handleMessage(event: MessageEvent) {
    if (
      typeof event.data === "object" &&
      event.data !== null &&
      event.data.type === "aura:theme-color" &&
      typeof event.data.color === "string"
    ) {
      setThemeColor(event.data.color);
    }
  }
  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, []);
```

- [ ] **Step 3: Clear theme color when navigating home**

In the `goHome` function, add `setThemeColor(null);` before the hash assignment:

```tsx
function goHome() {
  setThemeColor(null);
  setSearchQuery(null);
  window.location.hash = "";
}
```

- [ ] **Step 4: Apply theme color as a CSS custom property on the topbar**

In the JSX, update the `<header>` element to pass the style:

```tsx
<header
  class={`aura-topbar ${isStandalone ? "aura-topbar--app" : ""}`}
  style={themeColor ? { "--topbar-accent": themeColor } as preact.JSX.CSSProperties : undefined}
>
```

- [ ] **Step 5: Add CSS variable to topbar border**

In `src/shell/styles.css`, update `.aura-topbar` border-bottom:

```css
.aura-topbar {
  /* ... existing rules ... */
  border-bottom: 1px solid var(--topbar-accent, rgba(249, 115, 22, 0.18));
}
```

- [ ] **Step 6: Verify with demo site**

Run `npm run dev`. Navigate to the demo site (it declares `theme-color: #08111f`). The topbar border should shift slightly. Navigate home — border returns to orange.

- [ ] **Step 7: Commit**

```bash
git add src/shell/App.tsx src/shell/styles.css
git commit -m "feat(ink-ember): topbar accent tints to loaded site's theme-color"
```

---

### Task 10: Update demo site styles

**Files:**
- Modify: `public/demo-site/styles.css`

- [ ] **Step 1: Replace the demo site color tokens to harmonize with shell**

Replace the entire `:root` block in `public/demo-site/styles.css`:

```css
:root {
  color-scheme: dark;
  font-family: "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --bg: #0d0905;
  --bg-soft: rgba(31, 22, 13, 0.82);
  --line: rgba(255, 180, 80, 0.12);
  --text: #f5ede0;
  --muted: #9e8a72;
  --accent: #f97316;
  --accent-2: #f5c06e;
  --shadow: 0 28px 90px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 2: Update demo site body background**

Replace the `body { background: ... }` rule:

```css
body {
  background:
    radial-gradient(ellipse at 30% 0%, rgba(249, 115, 22, 0.10), transparent 45%),
    linear-gradient(180deg, #110c07 0%, var(--bg) 100%);
  color: var(--text);
}
```

- [ ] **Step 3: Add Google Fonts to demo site HTML files**

In `public/demo-site/index.html` and `public/demo-site/about.html`, add inside `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
```

- [ ] **Step 4: Verify demo site renders consistently**

Run `npm run dev`. Open the demo site. It should feel like it belongs in the same design family — warm dark background, orange/gold accents.

- [ ] **Step 5: Commit**

```bash
git add public/demo-site/styles.css public/demo-site/index.html public/demo-site/about.html
git commit -m "feat(ink-ember): update demo site to Ink & Ember tokens"
```

---

### Task 11: Final cleanup — remove leftover old variable references

**Files:**
- Modify: `src/shell/styles.css`

- [ ] **Step 1: Search for any remaining old tokens**

```bash
grep -n "accent-2\|--panel\|rgba(127, 147\|rgba(79, 219\|rgba(160, 178\|#7f93ff\|#4fdbc9\|#08192b\|#07111d\|backdrop-filter" src/shell/styles.css
```

- [ ] **Step 2: For each hit, replace with the new equivalent**

| Old | New |
|-----|-----|
| `var(--accent-2)` | `var(--accent-gold)` |
| `var(--panel)` | `var(--surface)` |
| `var(--panel-strong)` | `var(--surface-2)` |
| `rgba(127, 147, 255, ...)` | `rgba(249, 115, 22, ...)` (match opacity) |
| `rgba(79, 219, 201, ...)` | `rgba(245, 192, 110, ...)` (match opacity) |
| `rgba(160, 178, 205, ...)` | `rgba(255, 180, 80, ...)` (match opacity) |
| `backdrop-filter: blur(...)` | remove the line |
| `#7f93ff` | `#f97316` |
| `#4fdbc9` | `#f5c06e` |

- [ ] **Step 3: Run the grep again to confirm zero hits**

```bash
grep -n "accent-2\|--panel\|rgba(127, 147\|rgba(79, 219\|rgba(160, 178\|#7f93ff\|#4fdbc9\|#08192b\|#07111d\|backdrop-filter" src/shell/styles.css
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/shell/styles.css
git commit -m "feat(ink-ember): remove all legacy glassmorphism tokens"
```
