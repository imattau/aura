# Aura Showcase Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-page Aura project showcase site and a `publish.mjs` CLI script that uploads it to real Blossom servers and publishes a signed `kind:15128` manifest to real Nostr relays.

**Architecture:** The site lives in `public/aura-showcase/` as static HTML/CSS/JS with no external dependencies. The `publish.mjs` script generates a throwaway keypair (or accepts `--nsec`), SHA-256 hashes each file, uploads to `blossom.primal.net`, and publishes a fully-populated manifest event to three default relays.

**Tech Stack:** Node ESM (no build step), `nostr-tools` (already in package.json) for keypair generation/signing/relay, Node `crypto` for SHA-256, Node `fetch` for Blossom HTTP.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `public/aura-showcase/icon.svg` | Create | Site icon referenced in manifest |
| `public/aura-showcase/styles.css` | Create | Shared stylesheet, clean light product-landing |
| `public/aura-showcase/app.js` | Create | Minimal JS — smooth scroll, nav highlight |
| `public/aura-showcase/index.html` | Create | Landing page |
| `public/aura-showcase/how-it-works.html` | Create | Technical explainer page |
| `publish.mjs` | Create | Publisher CLI |
| `.gitignore` | Modify | Add `aura-identity.json` |

---

### Task 1: Icon and stylesheet

**Files:**
- Create: `public/aura-showcase/icon.svg`
- Create: `public/aura-showcase/styles.css`

- [ ] **Step 1: Create the icon**

`public/aura-showcase/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="28" fill="none" stroke="#4f46e5" stroke-width="4"/>
  <circle cx="32" cy="32" r="14" fill="none" stroke="#4f46e5" stroke-width="3" opacity="0.5"/>
  <circle cx="32" cy="32" r="5" fill="#4f46e5"/>
</svg>
```

- [ ] **Step 2: Create the stylesheet**

`public/aura-showcase/styles.css`:
```css
:root {
  --bg: #ffffff;
  --bg-soft: #f8f7ff;
  --line: rgba(79, 70, 229, 0.12);
  --text: #111827;
  --muted: #6b7280;
  --accent: #4f46e5;
  --accent-soft: #eef2ff;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  color-scheme: light;
}

*, *::before, *::after { box-sizing: border-box; }

html, body { margin: 0; min-height: 100%; }

body {
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.page-shell {
  width: min(1080px, calc(100vw - 2rem));
  margin: 0 auto;
  padding: clamp(1.5rem, 4vw, 3rem) 0 4rem;
}

/* Nav */
.site-nav {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 4rem;
}
.site-nav .logo {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--accent);
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.site-nav .logo img { width: 24px; height: 24px; }
.site-nav a { color: var(--muted); font-size: 0.9rem; }
.site-nav a:hover, .site-nav a[aria-current] { color: var(--text); text-decoration: none; }

/* Hero */
.hero {
  max-width: 680px;
  margin-bottom: 5rem;
}
.eyebrow {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}
.hero h1 {
  font-size: clamp(2.2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.1;
  margin: 0 0 1.25rem;
  color: var(--text);
}
.hero .lede {
  font-size: 1.15rem;
  color: var(--muted);
  margin: 0 0 2rem;
  max-width: 540px;
}
.hero-actions { display: flex; gap: 1rem; flex-wrap: wrap; }

.btn {
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1.4rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.85; text-decoration: none; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-ghost { background: transparent; color: var(--accent); border: 1.5px solid var(--line); }

/* How it works strip */
.how-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 5rem;
}
.how-card {
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 1.5rem;
}
.how-card .step-num {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}
.how-card h3 { margin: 0 0 0.5rem; font-size: 1rem; }
.how-card p { margin: 0; color: var(--muted); font-size: 0.9rem; }

/* Features */
.features {
  border-top: 1px solid var(--line);
  padding-top: 3rem;
  margin-bottom: 5rem;
}
.features h2 { font-size: 1.5rem; margin: 0 0 2rem; }
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
}
.feature-item { }
.feature-item strong { display: block; margin-bottom: 0.25rem; font-size: 0.95rem; }
.feature-item p { margin: 0; color: var(--muted); font-size: 0.875rem; }

/* CTA */
.cta-bar {
  background: var(--accent-soft);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 2rem 2.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.cta-bar h2 { margin: 0 0 0.25rem; font-size: 1.2rem; }
.cta-bar p { margin: 0; color: var(--muted); font-size: 0.9rem; }

/* How-it-works page */
.page-hero {
  max-width: 680px;
  margin-bottom: 3rem;
}
.page-hero h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 800; margin: 0 0 0.75rem; }
.page-hero p { color: var(--muted); font-size: 1.05rem; margin: 0; }

.steps { display: flex; flex-direction: column; gap: 2.5rem; margin-bottom: 4rem; }
.step {
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: 1rem;
  align-items: start;
}
.step-badge {
  width: 2.5rem; height: 2.5rem;
  background: var(--accent);
  color: #fff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}
.step-body h3 { margin: 0.2rem 0 0.4rem; font-size: 1rem; }
.step-body p { margin: 0; color: var(--muted); font-size: 0.9rem; }

.flow-diagram {
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 4rem;
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
  color: var(--muted);
  overflow-x: auto;
  white-space: pre;
  line-height: 1.8;
}
.flow-diagram .hl { color: var(--accent); font-weight: 700; }

.integrity-note {
  background: var(--accent-soft);
  border-left: 3px solid var(--accent);
  border-radius: 0 8px 8px 0;
  padding: 1.25rem 1.5rem;
}
.integrity-note h3 { margin: 0 0 0.4rem; font-size: 0.95rem; }
.integrity-note p { margin: 0; color: var(--muted); font-size: 0.875rem; }

footer {
  border-top: 1px solid var(--line);
  padding-top: 2rem;
  margin-top: 2rem;
  color: var(--muted);
  font-size: 0.8rem;
}
```

- [ ] **Step 3: Commit**

```bash
git add public/aura-showcase/icon.svg public/aura-showcase/styles.css
git commit -m "feat(showcase): add icon and stylesheet"
```

---

### Task 2: Minimal JS

**Files:**
- Create: `public/aura-showcase/app.js`

- [ ] **Step 1: Create app.js**

`public/aura-showcase/app.js`:
```js
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (e) => {
    const target = document.querySelector(anchor.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

const current = window.location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".site-nav a").forEach((a) => {
  const href = a.getAttribute("href");
  if (href === current || (current === "" && href === "index.html")) {
    a.setAttribute("aria-current", "page");
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add public/aura-showcase/app.js
git commit -m "feat(showcase): add minimal JS"
```

---

### Task 3: Landing page (index.html)

**Files:**
- Create: `public/aura-showcase/index.html`

- [ ] **Step 1: Create index.html**

`public/aura-showcase/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aura — Nostr-native web</title>
    <meta name="description" content="Aura is a Nostr-native web container. Publish complete websites using cryptographically verified blobs — no servers, no DNS." />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="page-shell">
      <nav class="site-nav" aria-label="Primary">
        <span class="logo">
          <img src="/icon.svg" alt="" aria-hidden="true" />
          Aura
        </span>
        <a href="index.html" aria-current="page">Home</a>
        <a href="how-it-works.html">How it works</a>
      </nav>

      <section class="hero">
        <div class="eyebrow">Nostr-native web</div>
        <h1>Publish websites<br/>without servers</h1>
        <p class="lede">
          Aura lets you host complete, multi-page websites on Nostr relays and
          Blossom storage — identified by your public key, assembled in the
          browser by a Service Worker, with no DNS and no traditional
          infrastructure.
        </p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="how-it-works.html">How it works</a>
          <a class="btn btn-ghost" href="https://github.com/imattau/aura">View source</a>
        </div>
      </section>

      <section class="how-strip" aria-label="How Aura works">
        <div class="how-card">
          <div class="step-num">Step 1</div>
          <h3>Nostr manifest</h3>
          <p>You publish a <code>kind:15128</code> event mapping your site's URL paths to SHA-256 blob hashes. Your Nostr key is your domain.</p>
        </div>
        <div class="how-card">
          <div class="step-num">Step 2</div>
          <h3>Blossom storage</h3>
          <p>Your HTML, CSS, JS and assets live on Blossom servers as immutable, content-addressed blobs — anyone can mirror them.</p>
        </div>
        <div class="how-card">
          <div class="step-num">Step 3</div>
          <h3>Browser assembles</h3>
          <p>A Service Worker intercepts navigation requests, fetches the manifest from a relay, retrieves verified blobs, and constructs the page locally.</p>
        </div>
      </section>

      <section class="features">
        <h2>What makes it different</h2>
        <div class="feature-grid">
          <div class="feature-item">
            <strong>No DNS</strong>
            <p>Sites are addressed by Nostr public key — no domain registrar, no nameserver, no ICANN.</p>
          </div>
          <div class="feature-item">
            <strong>No origin server</strong>
            <p>After the Service Worker installs, zero bytes flow through any server you control.</p>
          </div>
          <div class="feature-item">
            <strong>Content integrity</strong>
            <p>Every blob is verified by SHA-256 before it reaches the browser. Tampered files are rejected silently.</p>
          </div>
          <div class="feature-item">
            <strong>Censorship resistant</strong>
            <p>Blobs are public and anyone can mirror them. Relay your manifest to as many relays as you like.</p>
          </div>
          <div class="feature-item">
            <strong>Nostr-native identity</strong>
            <p>Your npub is your website address. Sign in with NIP-07 or NIP-46 — no passwords.</p>
          </div>
          <div class="feature-item">
            <strong>Versioned publishing</strong>
            <p>Publish a new manifest event to update your site. Old versions remain accessible if anyone cached them.</p>
          </div>
        </div>
      </section>

      <div class="cta-bar">
        <div>
          <h2>See how the request works</h2>
          <p>Trace a page load from the address bar to the browser response.</p>
        </div>
        <a class="btn btn-primary" href="how-it-works.html">Read the walkthrough →</a>
      </div>
    </main>

    <footer class="page-shell">
      <p>Built with Aura. Published on Nostr. This page was assembled by a Service Worker from content-addressed blobs.</p>
    </footer>

    <script type="module" src="/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/aura-showcase/index.html
git commit -m "feat(showcase): add landing page"
```

---

### Task 4: How-it-works page

**Files:**
- Create: `public/aura-showcase/how-it-works.html`

- [ ] **Step 1: Create how-it-works.html**

`public/aura-showcase/how-it-works.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>How Aura works</title>
    <meta name="description" content="Trace an Aura page load from the address bar to the browser response — step by step." />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="page-shell">
      <nav class="site-nav" aria-label="Primary">
        <span class="logo">
          <img src="/icon.svg" alt="" aria-hidden="true" />
          Aura
        </span>
        <a href="index.html">Home</a>
        <a href="how-it-works.html" aria-current="page">How it works</a>
      </nav>

      <div class="page-hero">
        <h1>How a page load works</h1>
        <p>From the address bar to rendered HTML — no origin server involved.</p>
      </div>

      <div class="steps">
        <div class="step">
          <div class="step-badge">1</div>
          <div class="step-body">
            <h3>You navigate to a site</h3>
            <p>The Aura shell receives a navigation to <code>/~npub1…/index.html</code>. The npub in the path identifies the site owner's Nostr public key.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-badge">2</div>
          <div class="step-body">
            <h3>Service Worker intercepts</h3>
            <p>The installed Service Worker catches the <code>FetchEvent</code> before it reaches the network. No request leaves the browser yet.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-badge">3</div>
          <div class="step-body">
            <h3>Manifest fetched from relay</h3>
            <p>The SW opens a WebSocket to one or more Nostr relays and requests the latest <code>kind:15128</code> event authored by the site's pubkey. This event contains the full path→hash map for the site.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-badge">4</div>
          <div class="step-body">
            <h3>Path resolved to hash</h3>
            <p>The SW looks up <code>/index.html</code> in the manifest's <code>files</code> map and retrieves the corresponding SHA-256 hash.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-badge">5</div>
          <div class="step-body">
            <h3>Blob fetched from Blossom</h3>
            <p>The SW fetches the blob from a Blossom server using the hash as the URL path: <code>https://blossom.primal.net/&lt;sha256&gt;</code>. Blossom servers are pure content-addressed storage — any server holding the hash can serve it.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-badge">6</div>
          <div class="step-body">
            <h3>Hash verified</h3>
            <p>Before handing the blob to the browser, the SW computes its SHA-256 and compares it to the hash from the manifest. If they don't match, the blob is discarded and the fetch fails.</p>
          </div>
        </div>
        <div class="step">
          <div class="step-badge">7</div>
          <div class="step-body">
            <h3>Response constructed locally</h3>
            <p>The SW constructs a synthetic <code>Response</code> object with the correct <code>Content-Type</code> header and returns it to the browser. The page renders normally — the browser never knew there was no server.</p>
          </div>
        </div>
      </div>

      <div class="flow-diagram" role="img" aria-label="Request flow diagram"><span class="hl">Browser</span>  navigate /~npub1…/index.html
   │
   ▼
<span class="hl">Service Worker</span>  intercepts FetchEvent
   │
   ├─▶ <span class="hl">Nostr Relay</span>  REQ kind:15128 by pubkey
   │        ◀── EVENT { files: { "/index.html": "abc123…" } }
   │
   ├─▶ <span class="hl">Blossom Server</span>  GET /abc123…
   │        ◀── blob bytes
   │
   ├─ verify SHA-256(blob) === "abc123…"  ✓
   │
   └─▶ <span class="hl">Browser</span>  Response(blob, { Content-Type: text/html })</div>

      <div class="integrity-note">
        <h3>Content integrity by default</h3>
        <p>Because every file is identified by its SHA-256 hash in the manifest — and the manifest is signed by the site owner's Nostr key — a visitor cannot be served a tampered file without the hash check failing. There is no TLS certificate to steal, no CDN to compromise, and no origin server to target.</p>
      </div>
    </main>

    <footer class="page-shell">
      <p>Built with Aura. Published on Nostr. This page was assembled by a Service Worker from content-addressed blobs.</p>
    </footer>

    <script type="module" src="/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/aura-showcase/how-it-works.html
git commit -m "feat(showcase): add how-it-works page"
```

---

### Task 5: Publisher script (`publish.mjs`)

**Files:**
- Create: `publish.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Add aura-identity.json to .gitignore**

Open `.gitignore` and append:
```
aura-identity.json
```

- [ ] **Step 2: Create publish.mjs**

`publish.mjs`:
```js
#!/usr/bin/env node
// Publishes public/aura-showcase/ to Blossom and Nostr.
// Usage: node publish.mjs [--nsec <nsec>]

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { WebSocket } from "node:events";
import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { SimplePool } from "nostr-tools/pool";
import ws from "node:module";

// nostr-tools needs a WebSocket implementation in Node
import { WebSocket as WS } from "node:events";

// ── Config ────────────────────────────────────────────────────────────────────

const SITE_DIR = "public/aura-showcase";
const IDENTITY_FILE = "aura-identity.json";
const BLOSSOM_SERVER = "https://blossom.primal.net";
const RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];
const MANIFEST_KIND = 15128;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function listFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function urlPath(filePath) {
  // e.g. "public/aura-showcase/index.html" → "/index.html"
  const rel = relative(SITE_DIR, filePath);
  return "/" + rel.replace(/\\/g, "/");
}

function mimeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

// ── Keypair resolution ────────────────────────────────────────────────────────

function resolveKeypair(args) {
  const nsecIdx = args.indexOf("--nsec");
  if (nsecIdx !== -1 && args[nsecIdx + 1]) {
    const nsec = args[nsecIdx + 1];
    const decoded = nip19.decode(nsec);
    if (decoded.type !== "nsec") throw new Error("Invalid nsec");
    const sk = decoded.data;
    const pk = getPublicKey(sk);
    console.log("Using supplied nsec");
    return { sk, pk };
  }

  if (existsSync(IDENTITY_FILE)) {
    const saved = JSON.parse(readFileSync(IDENTITY_FILE, "utf8"));
    const sk = Uint8Array.from(Buffer.from(saved.skHex, "hex"));
    const pk = getPublicKey(sk);
    console.log(`Loaded existing identity from ${IDENTITY_FILE}`);
    return { sk, pk };
  }

  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const skHex = Buffer.from(sk).toString("hex");
  writeFileSync(IDENTITY_FILE, JSON.stringify({ skHex }, null, 2));
  console.log(`Generated new throwaway keypair → saved to ${IDENTITY_FILE}`);
  return { sk, pk };
}

// ── Blossom upload ────────────────────────────────────────────────────────────

async function uploadBlob(sha256, body, mime) {
  const url = `${BLOSSOM_SERVER}/${sha256}`;

  const head = await fetch(url, { method: "HEAD" });
  if (head.ok) {
    return "already exists";
  }

  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": mime, "Content-Length": String(body.length) },
    body,
  });

  if (!put.ok) {
    throw new Error(`Blossom PUT failed: ${put.status} ${put.statusText}`);
  }
  return "uploaded";
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Resolve keypair
  const { sk, pk } = resolveKeypair(process.argv.slice(2));
  const npub = nip19.npubEncode(pk);

  // 2. Hash files
  const files = listFiles(SITE_DIR);
  const fileMap = {}; // path → sha256

  for (const filePath of files) {
    const body = readFileSync(filePath);
    const sha256 = sha256Hex(body);
    fileMap[urlPath(filePath)] = sha256;
  }

  // 3. Upload blobs
  console.log("\nUploading blobs to", BLOSSOM_SERVER);
  for (const filePath of files) {
    const body = readFileSync(filePath);
    const sha256 = fileMap[urlPath(filePath)];
    const mime = mimeFor(filePath);
    const result = await uploadBlob(sha256, body, mime);
    console.log(`  ✓ ${result.padEnd(14)} ${urlPath(filePath)}`);
  }

  // 4. Sign and publish manifest
  const content = JSON.stringify({
    files: fileMap,
    description: "Aura is a Nostr-native web container. Publish complete websites using cryptographically verified blobs — no servers, no DNS.",
    icon: "/icon.svg",
    version: "1.0.0",
    start_path: "/index.html",
    theme_color: "#4f46e5",
  });

  const template = {
    kind: MANIFEST_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags: [
      ["t", "aura-site"],
      ["name", "aura-showcase"],
      ["description", "Aura is a Nostr-native web container. Publish complete websites using cryptographically verified blobs — no servers, no DNS."],
      ["icon", "/icon.svg"],
      ["version", "1.0.0"],
      ["start_path", "/index.html"],
      ["theme_color", "#4f46e5"],
    ],
  };

  const event = finalizeEvent(template, sk);

  console.log("\nPublishing manifest to relays");

  // Publish to each relay independently
  for (const relay of RELAYS) {
    try {
      await publishToRelay(relay, event);
      console.log(`  ✓ published   ${relay}`);
    } catch (err) {
      console.log(`  ✗ failed      ${relay} (${err.message})`);
    }
  }

  // 5. Print result
  console.log(`\nnpub: ${npub}`);
  console.log(`\nDone. Load the site in Aura at /~${npub}/`);
}

function publishToRelay(relayUrl, event) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(relayUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("timeout"));
    }, 8000);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify(["EVENT", event]));
    });

    socket.addEventListener("message", (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (Array.isArray(data) && data[0] === "OK") {
          clearTimeout(timeout);
          socket.close();
          if (data[2] === true) {
            resolve();
          } else {
            reject(new Error(data[3] || "relay rejected event"));
          }
        }
      } catch {}
    });

    socket.addEventListener("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(err.message || "websocket error"));
    });
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Verify nostr-tools exports are correct**

Check that the imports exist in the installed version:
```bash
node -e "import('nostr-tools').then(m => console.log(Object.keys(m).filter(k => ['generateSecretKey','getPublicKey','finalizeEvent','nip19'].includes(k))))"
```
Expected output: `[ 'generateSecretKey', 'getPublicKey', 'finalizeEvent', 'nip19' ]`

Also check the pool import path:
```bash
node -e "import('nostr-tools/pool').then(m => console.log(Object.keys(m)))"
```

If `nostr-tools/pool` doesn't export `SimplePool` or `useWebSocketImplementation`, adjust the WebSocket relay publishing to use the raw `WebSocket` approach already in `publishToRelay` (which doesn't need the pool at all — the pool import in the script above is unused and should be removed).

**Fix the script**: remove the unused pool imports so publish.mjs actually runs cleanly:

Replace the import block at the top with:
```js
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from "nostr-tools";
```

And replace the `WebSocket` usage in `publishToRelay` with the global `WebSocket` (available in Node 22+) or import from a package. Check Node version:
```bash
node --version
```

If Node < 22, install `ws` or use the `--experimental-websocket` flag. The simplest fix for broad compatibility is to add to the top of the script:
```js
import { WebSocket } from "ws";
```

Check if `ws` is available:
```bash
node -e "import('ws').then(() => console.log('ws available')).catch(() => console.log('not available'))"
```

If not available, install it:
```bash
npm install ws
```

- [ ] **Step 4: Test dry run (no network)**

```bash
node -e "
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
const sk = generateSecretKey();
const pk = getPublicKey(sk);
console.log('npub:', nip19.npubEncode(pk));
"
```
Expected: prints a valid `npub1…` string.

- [ ] **Step 5: Commit**

```bash
git add publish.mjs .gitignore
git commit -m "feat: add publish.mjs CLI for Blossom upload and kind:15128 manifest"
```

---

### Task 6: Live publish

- [ ] **Step 1: Run the publisher**

```bash
node publish.mjs
```

Expected output (approximately):
```
Generated new throwaway keypair → saved to aura-identity.json

Uploading blobs to https://blossom.primal.net
  ✓ uploaded       /icon.svg
  ✓ uploaded       /styles.css
  ✓ uploaded       /app.js
  ✓ uploaded       /index.html
  ✓ uploaded       /how-it-works.html

Publishing manifest to relays
  ✓ published   wss://relay.damus.io
  ✓ published   wss://relay.nostr.band
  ✓ published   wss://nos.lol

npub: npub1…

Done. Load the site in Aura at /~npub1…/
```

- [ ] **Step 2: Verify blobs are accessible**

Take the SHA-256 of any file from the output and check it's retrievable:
```bash
curl -I https://blossom.primal.net/<sha256-from-output>
```
Expected: `HTTP/2 200`

- [ ] **Step 3: Verify manifest on relay**

```bash
node -e "
const npub = '<paste npub from output>';
import { nip19 } from 'nostr-tools';
const { data: pk } = nip19.decode(npub);
console.log('pubkey:', pk);
"
```

Then query the relay manually or load the site in Aura dev server at `http://localhost:3000` and navigate to `/~<npub>/`.

- [ ] **Step 4: Commit any fixes discovered during live test**

```bash
git add -p
git commit -m "fix(showcase): <describe fix>"
```
