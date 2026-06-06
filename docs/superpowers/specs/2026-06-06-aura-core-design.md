# Aura Core Design Spec
_2026-06-06_

## Overview

Aura is a Nostr-native web container. It lets Nostr users publish and browse complete web applications — identified purely by Nostr pubkey, with no DNS dependency — using Nostr relays for content routing and Blossom servers for immutable blob storage. A Service Worker in the browser assembles pages on the fly from cryptographically verified blobs.

## Target Audience

Nostr users. Both publishers (site owners) and visitors authenticate with a Nostr key.

---

## Stack

| Concern | Choice |
|---|---|
| Build tool | Vite |
| UI framework | Preact + TypeScript |
| Nostr client | applesauce-core, applesauce-relay, applesauce-signer |
| Low-level Nostr primitives | nostr-tools |
| Testing | Vitest |
| Linting / formatting | Biome |

---

## Repository Structure

```
aura/
├── src/
│   ├── shell/       # Preact app — address bar, auth UI, petname store, settings
│   ├── sw/          # Service Worker — manifest resolution, blob fetching, response construction
│   ├── nostr/       # Relay pool and event queries via applesauce
│   ├── blossom/     # Blob fetching, server selection, SHA-256 verification
│   └── crypto/      # Hash utilities
├── public/          # Static shell assets (favicon, etc.)
├── docs/
└── vite.config.ts   # Two entry points: shell (src/shell/main.tsx) + SW (src/sw/sw.ts)
```

---

## Bootstrap Server

A static file server (nginx, caddy, or a minimal Node server) serves the shell HTML/JS/SW assets. After the Service Worker installs in the visitor's browser, the bootstrap server plays no further role. All subsequent communication is browser-to-relay and browser-to-Blossom directly. The bootstrap server requires no custom logic and can be self-hosted on any infrastructure.

---

## Authentication

Handled by `applesauce-signer`. On load the shell checks for NIP-07 (`window.nostr`) first. If absent, it presents a NIP-46 (Nostr Connect) connection string input. No raw nsec handling.

**State machine:**
```
unauthenticated
  → NIP-07 detected  → request pubkey → authenticated
  → NIP-07 absent    → NIP-46 input   → await remote signer → authenticated
  → authenticated    → load NIP-65 relay list → relay pool ready
```

**Key storage:** Only the pubkey is held in memory. The extension retains the key for NIP-07. NIP-46 session tokens are stored in `sessionStorage` only (cleared on tab close).

---

## Relay Discovery

Priority order:
1. User's NIP-65 relay list (read via applesauce-relay)
2. 2–3 hardcoded default relays (fallback if NIP-65 unavailable)

The relay pool is initialised after authentication and shared across the shell and (via `postMessage`) the Service Worker.

---

## Site Addressing

### Internal SW path
All Nostr-hosted site requests are routed via a sigil-prefixed virtual path — no DNS name embedded:
```
/~<npub>/<path>
/~npub1abc.../blog/index.html
```

### Human-readable names
The `kind:15128` manifest event published by the site owner includes a `["name", "site-name"]` tag. When the shell first resolves a manifest, it registers a local petname mapping:
```
"site-name" → npub1abc...
```
The address bar displays the petname. Names are local to the visitor's shell instance; first-seen wins on collision, user can rename. No global registry, no DNS.

---

## Service Worker — Request Lifecycle

The SW intercepts all `FetchEvent`s matching `/~<npub>/...`:

```
FetchEvent: GET /~npub1abc.../blog/index.html
  1. Parse npub + path
  2. Check CacheStorage for valid manifest (TTL ~5 min)
     → cache miss: query Nostr relays for kind:15128 signed by npub
  3. Extract SHA-256 hash for requested path from manifest
  4. Fetch blob:
     a. Try site owner's Blossom servers (from BUD-03 event) in order
     b. Fall back to hardcoded default Blossom servers
  5. Verify blob SHA-256 matches manifest entry (reject → 403 if mismatch)
  6. Construct Response with correct MIME type → return to browser
```

**Integrity:** No unverified content is ever executed. Hash mismatch → synthetic 403.

**Manifest caching:** Stored in `CacheStorage` with ~5 min TTL to avoid relay load on every navigation.

---

## Blossom Blob Fetching

Handled by `src/blossom/`. Server selection order:
1. Site owner's published server list (BUD-03 event, fetched from Nostr)
2. Hardcoded default Blossom servers

SHA-256 verification is performed on every blob before it is returned by the SW. The browser receives only verified content.

---

## Browser Capabilities / Site Complexity Ceiling

Aura-hosted sites receive fully-formed HTML/CSS/JS responses from the SW — identical to responses from a traditional web server. The full modern browser feature set is available to published sites:

- Rich SPAs (React, Svelte, Vue bundles published as blobs)
- CSS, fonts, images, video, WebAssembly, Canvas, WebGL
- Client-side routing (hash-based or History API)
- Sites may open their own WebSocket/fetch connections (the SW only intercepts `/~<npub>/...` paths)

**Constraint:** All assets must be pre-published to Blossom as static blobs. No server-side rendering.

**Storage scope note:** `localStorage` and `IndexedDB` within hosted sites are scoped to the shell origin. This is a known constraint to handle carefully as the platform matures.

---

## Nostr Event Types

| Kind | Purpose |
|---|---|
| `15128` | Site manifest — maps URL paths to SHA-256 blob hashes, includes `["name", ...]` tag |
| NIP-65 relay list | Visitor's relay preferences |
| BUD-03 | Site owner's Blossom server list |
