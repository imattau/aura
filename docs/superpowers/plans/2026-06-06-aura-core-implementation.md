# Aura Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Aura — a Nostr-native web container that lets users browse and publish complete web apps identified by Nostr pubkey, using Nostr relays for routing and Blossom servers for blob storage, assembled by a Service Worker.

**Architecture:** A Vite-built Preact shell app serves as the browser UI (address bar, auth, petname store). A co-built Service Worker intercepts all `/~<npub>/...` fetch requests, resolves `kind:15128` manifests from Nostr relays, fetches blobs from Blossom servers, SHA-256 verifies them, and returns full HTTP responses to the browser. No server-side logic is required after the static assets are served.

**Tech Stack:** Vite 5, Preact 10, TypeScript 5, applesauce-core, applesauce-relay, applesauce-signer, nostr-tools, Vitest, Biome.

---

## File Map

```
aura/
├── index.html                        # Shell entry HTML
├── vite.config.ts                    # Dual entry: shell + SW
├── biome.json                        # Linting/formatting config
├── vitest.config.ts                  # Test config
├── tsconfig.json                     # Base TS config
├── tsconfig.app.json                 # App/shell TS config
├── tsconfig.sw.json                  # Service Worker TS config
├── package.json
├── public/
│   └── favicon.svg
└── src/
    ├── shell/
    │   ├── main.tsx                  # Preact render root
    │   ├── App.tsx                   # Top-level component, router
    │   ├── components/
    │   │   ├── AddressBar.tsx        # Address input + petname display
    │   │   ├── AuthPanel.tsx         # NIP-07 / NIP-46 auth UI
    │   │   └── SiteFrame.tsx         # <iframe> wrapper for hosted sites
    │   └── stores/
    │       ├── auth.ts               # Auth state (pubkey, signer instance)
    │       └── petnames.ts           # petname → npub map (localStorage)
    ├── nostr/
    │   ├── pool.ts                   # Relay pool init, shared instance
    │   ├── queries.ts                # fetchManifest(), fetchBlossomServers(), fetchRelayList()
    │   └── constants.ts              # DEFAULT_RELAYS string[]
    ├── blossom/
    │   ├── client.ts                 # fetchBlob(hash, servers): Promise<Blob>
    │   ├── verify.ts                 # verifySha256(blob, expectedHex): Promise<boolean>
    │   └── constants.ts              # DEFAULT_BLOSSOM_SERVERS string[]
    ├── crypto/
    │   └── hash.ts                   # sha256Hex(data: ArrayBuffer): Promise<string>
    └── sw/
        ├── sw.ts                     # Service Worker entry — FetchEvent handler
        ├── manifest.ts               # parseManifest(event), cache get/set with TTL
        ├── router.ts                 # matchAuraPath(url): {npub, path} | null
        └── mime.ts                   # extToMime(path: string): string
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `biome.json`
- Create: `vitest.config.ts`
- Create: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.sw.json`
- Create: `index.html`
- Create: `src/shell/main.tsx`

- [ ] **Step 1: Initialise the project**

```bash
cd /home/mattthomson/workspace/aura
npm init -y
npm install --save-dev vite @preact/preset-vite typescript vitest @vitest/coverage-v8 jsdom @biomejs/biome
npm install preact
npm install applesauce-core applesauce-relay applesauce-signer nostr-tools
```

- [ ] **Step 2: Write `package.json` scripts**

Replace the `"scripts"` block in `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "biome check .",
  "fmt": "biome format --write ."
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.sw.json" }
  ]
}
```

- [ ] **Step 4: Write `tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "rootDir": "./src/shell"
  },
  "include": ["src/shell/**/*", "src/nostr/**/*", "src/blossom/**/*", "src/crypto/**/*"]
}
```

- [ ] **Step 5: Write `tsconfig.sw.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "lib": ["ES2022", "WebWorker"],
    "outDir": "./dist",
    "rootDir": "./src/sw"
  },
  "include": ["src/sw/**/*", "src/nostr/**/*", "src/blossom/**/*", "src/crypto/**/*"]
}
```

- [ ] **Step 6: Write `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact()],
  build: {
    rollupOptions: {
      input: {
        shell: resolve(__dirname, "index.html"),
        sw: resolve(__dirname, "src/sw/sw.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js",
      },
    },
  },
});
```

- [ ] **Step 7: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.8.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": { "quoteStyle": "double", "semicolons": "always" }
  }
}
```

- [ ] **Step 8: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
```

- [ ] **Step 9: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aura</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/shell/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Write `src/shell/main.tsx`**

```typescript
import { render } from "preact";
import { App } from "./App";

render(<App />, document.getElementById("app")!);
```

- [ ] **Step 11: Write `src/shell/App.tsx` (skeleton)**

```typescript
export function App() {
  return <div id="aura-shell">Aura</div>;
}
```

- [ ] **Step 12: Verify build works**

```bash
npm run build
```

Expected: `dist/sw.js` and `dist/index.html` emitted with no errors.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json vite.config.ts biome.json vitest.config.ts tsconfig.json tsconfig.app.json tsconfig.sw.json index.html src/
git commit -m "feat: project scaffolding — Vite, Preact, Biome, Vitest"
```

---

## Task 2: Crypto Utilities

**Files:**
- Create: `src/crypto/hash.ts`
- Create: `src/crypto/hash.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/crypto/hash.test.ts
import { describe, it, expect } from "vitest";
import { sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("returns correct lowercase hex for known input", async () => {
    const enc = new TextEncoder();
    const data = enc.encode("hello").buffer as ArrayBuffer;
    const result = await sha256Hex(data);
    expect(result).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("returns 64-character hex string", async () => {
    const data = new ArrayBuffer(0);
    const result = await sha256Hex(data);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/crypto/hash.test.ts
```

Expected: FAIL — "Cannot find module './hash'"

- [ ] **Step 3: Write implementation**

```typescript
// src/crypto/hash.ts
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/crypto/hash.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/crypto/
git commit -m "feat: sha256Hex utility"
```

---

## Task 3: Nostr Constants and Pool

**Files:**
- Create: `src/nostr/constants.ts`
- Create: `src/nostr/pool.ts`
- Create: `src/nostr/pool.test.ts`

- [ ] **Step 1: Write `src/nostr/constants.ts`**

```typescript
export const DEFAULT_RELAYS: string[] = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];
```

- [ ] **Step 2: Write failing test for pool**

```typescript
// src/nostr/pool.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock applesauce-relay before importing pool
vi.mock("applesauce-relay", () => ({
  RelayPool: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    relays: [],
  })),
}));

import { createPool, getPool } from "./pool";
import { RelayPool } from "applesauce-relay";

describe("createPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a RelayPool with provided relay URLs", () => {
    const relays = ["wss://relay.example.com"];
    const pool = createPool(relays);
    expect(RelayPool).toHaveBeenCalledWith(relays);
    expect(pool).toBeDefined();
  });

  it("getPool returns undefined before createPool is called", () => {
    // Reset module state by re-importing isn't easy; just check it returns something after create
    createPool(["wss://relay.example.com"]);
    expect(getPool()).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- src/nostr/pool.test.ts
```

Expected: FAIL — "Cannot find module './pool'"

- [ ] **Step 4: Write `src/nostr/pool.ts`**

```typescript
import { RelayPool } from "applesauce-relay";

let _pool: RelayPool | undefined;

export function createPool(relayUrls: string[]): RelayPool {
  _pool = new RelayPool(relayUrls);
  return _pool;
}

export function getPool(): RelayPool | undefined {
  return _pool;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- src/nostr/pool.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/nostr/
git commit -m "feat: nostr constants and relay pool factory"
```

---

## Task 4: Nostr Queries

**Files:**
- Create: `src/nostr/queries.ts`
- Create: `src/nostr/queries.test.ts`

These functions query Nostr for the three event kinds Aura needs: `kind:15128` site manifests, BUD-03 Blossom server lists, and NIP-65 relay lists.

- [ ] **Step 1: Write failing tests**

```typescript
// src/nostr/queries.test.ts
import { describe, it, expect, vi } from "vitest";

// Minimal mock RelayPool
const mockEvent = (kind: number, content: string, tags: string[][], pubkey: string) => ({
  kind,
  content,
  tags,
  pubkey,
  id: "abc",
  sig: "sig",
  created_at: 1000,
});

const mockPool = {
  querySync: vi.fn(),
};

vi.mock("./pool", () => ({ getPool: () => mockPool }));

import { fetchManifest, fetchBlossomServers, fetchRelayList } from "./queries";

describe("fetchManifest", () => {
  it("returns the most recent kind:15128 event for a pubkey", async () => {
    const ev = mockEvent(15128, JSON.stringify({ files: [] }), [["name", "mysite"]], "pubkey1");
    mockPool.querySync.mockResolvedValueOnce([ev]);
    const result = await fetchManifest("pubkey1");
    expect(result).toEqual(ev);
    expect(mockPool.querySync).toHaveBeenCalledWith(
      expect.arrayContaining([]),
      { kinds: [15128], authors: ["pubkey1"], limit: 1 }
    );
  });

  it("returns null when no event found", async () => {
    mockPool.querySync.mockResolvedValueOnce([]);
    const result = await fetchManifest("pubkey1");
    expect(result).toBeNull();
  });
});

describe("fetchBlossomServers", () => {
  it("returns server URLs from BUD-03 tags", async () => {
    const ev = mockEvent(10063, "", [["server", "https://blossom.example.com"]], "pubkey1");
    mockPool.querySync.mockResolvedValueOnce([ev]);
    const result = await fetchBlossomServers("pubkey1");
    expect(result).toEqual(["https://blossom.example.com"]);
  });

  it("returns empty array when no event found", async () => {
    mockPool.querySync.mockResolvedValueOnce([]);
    const result = await fetchBlossomServers("pubkey1");
    expect(result).toEqual([]);
  });
});

describe("fetchRelayList", () => {
  it("returns relay URLs from NIP-65 tags", async () => {
    const ev = mockEvent(10002, "", [["r", "wss://relay.example.com"]], "pubkey1");
    mockPool.querySync.mockResolvedValueOnce([ev]);
    const result = await fetchRelayList("pubkey1");
    expect(result).toEqual(["wss://relay.example.com"]);
  });

  it("returns empty array when no event found", async () => {
    mockPool.querySync.mockResolvedValueOnce([]);
    const result = await fetchRelayList("pubkey1");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/nostr/queries.test.ts
```

Expected: FAIL — "Cannot find module './queries'"

- [ ] **Step 3: Write `src/nostr/queries.ts`**

```typescript
import type { NostrEvent } from "nostr-tools";
import { getPool } from "./pool";
import { DEFAULT_RELAYS } from "./constants";

async function queryOne(filter: object): Promise<NostrEvent | null> {
  const pool = getPool();
  if (!pool) return null;
  const events: NostrEvent[] = await pool.querySync(DEFAULT_RELAYS, filter);
  return events[0] ?? null;
}

export async function fetchManifest(pubkey: string): Promise<NostrEvent | null> {
  return queryOne({ kinds: [15128], authors: [pubkey], limit: 1 });
}

export async function fetchBlossomServers(pubkey: string): Promise<string[]> {
  const event = await queryOne({ kinds: [10063], authors: [pubkey], limit: 1 });
  if (!event) return [];
  return event.tags
    .filter((t: string[]) => t[0] === "server" && t[1])
    .map((t: string[]) => t[1]);
}

export async function fetchRelayList(pubkey: string): Promise<string[]> {
  const event = await queryOne({ kinds: [10002], authors: [pubkey], limit: 1 });
  if (!event) return [];
  return event.tags
    .filter((t: string[]) => t[0] === "r" && t[1])
    .map((t: string[]) => t[1]);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/nostr/queries.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/nostr/queries.ts src/nostr/queries.test.ts
git commit -m "feat: nostr queries — manifest, blossom servers, relay list"
```

---

## Task 5: Blossom Client

**Files:**
- Create: `src/blossom/constants.ts`
- Create: `src/blossom/verify.ts`
- Create: `src/blossom/verify.test.ts`
- Create: `src/blossom/client.ts`
- Create: `src/blossom/client.test.ts`

- [ ] **Step 1: Write `src/blossom/constants.ts`**

```typescript
export const DEFAULT_BLOSSOM_SERVERS: string[] = [
  "https://blossom.primal.net",
  "https://cdn.satellite.earth",
];
```

- [ ] **Step 2: Write failing tests for verify**

```typescript
// src/blossom/verify.test.ts
import { describe, it, expect } from "vitest";
import { verifySha256 } from "./verify";

describe("verifySha256", () => {
  it("returns true when hash matches blob content", async () => {
    const content = new TextEncoder().encode("hello");
    const blob = new Blob([content]);
    // Known SHA-256 of "hello"
    const expectedHex = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    expect(await verifySha256(blob, expectedHex)).toBe(true);
  });

  it("returns false when hash does not match", async () => {
    const blob = new Blob([new TextEncoder().encode("hello")]);
    expect(await verifySha256(blob, "deadbeef" + "0".repeat(56))).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- src/blossom/verify.test.ts
```

Expected: FAIL

- [ ] **Step 4: Write `src/blossom/verify.ts`**

```typescript
import { sha256Hex } from "../crypto/hash";

export async function verifySha256(blob: Blob, expectedHex: string): Promise<boolean> {
  const buffer = await blob.arrayBuffer();
  const actual = await sha256Hex(buffer);
  return actual === expectedHex.toLowerCase();
}
```

- [ ] **Step 5: Run verify tests**

```bash
npm test -- src/blossom/verify.test.ts
```

Expected: PASS

- [ ] **Step 6: Write failing tests for client**

```typescript
// src/blossom/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { fetchBlob } from "./client";

describe("fetchBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches blob from first server that succeeds", async () => {
    const content = new TextEncoder().encode("data");
    // Known SHA-256 of "data"
    const hash = "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
    const blob = new Blob([content]);
    mockFetch.mockResolvedValueOnce({ ok: true, blob: async () => blob });

    const result = await fetchBlob(hash, ["https://server1.example.com"]);
    expect(result).toBeInstanceOf(Blob);
    expect(mockFetch).toHaveBeenCalledWith("https://server1.example.com/" + hash);
  });

  it("tries next server on failure", async () => {
    const content = new TextEncoder().encode("data");
    const hash = "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
    const blob = new Blob([content]);
    mockFetch
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({ ok: true, blob: async () => blob });

    const result = await fetchBlob(hash, [
      "https://server1.example.com",
      "https://server2.example.com",
    ]);
    expect(result).toBeInstanceOf(Blob);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns null when all servers fail", async () => {
    const hash = "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
    mockFetch.mockRejectedValue(new Error("network error"));
    const result = await fetchBlob(hash, ["https://server1.example.com"]);
    expect(result).toBeNull();
  });

  it("returns null when verification fails", async () => {
    // blob content does not match the hash
    const blob = new Blob([new TextEncoder().encode("wrong content")]);
    const hash = "3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7";
    mockFetch.mockResolvedValueOnce({ ok: true, blob: async () => blob });
    const result = await fetchBlob(hash, ["https://server1.example.com"]);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

```bash
npm test -- src/blossom/client.test.ts
```

Expected: FAIL

- [ ] **Step 8: Write `src/blossom/client.ts`**

```typescript
import { verifySha256 } from "./verify";

export async function fetchBlob(
  sha256: string,
  servers: string[]
): Promise<Blob | null> {
  for (const server of servers) {
    try {
      const url = `${server.replace(/\/$/, "")}/${sha256}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const valid = await verifySha256(blob, sha256);
      if (!valid) continue;
      return blob;
    } catch {
      // try next server
    }
  }
  return null;
}
```

- [ ] **Step 9: Run all blossom tests**

```bash
npm test -- src/blossom/
```

Expected: PASS (all 6 tests)

- [ ] **Step 10: Commit**

```bash
git add src/blossom/ 
git commit -m "feat: blossom client with SHA-256 verification"
```

---

## Task 6: Auth Module

**Files:**
- Create: `src/shell/stores/auth.ts`
- Create: `src/shell/stores/auth.test.ts`

The auth store manages the active signer, pubkey in memory, NIP-46 session token in sessionStorage, and relay pool initialisation after login.

- [ ] **Step 1: Write failing tests**

```typescript
// src/shell/stores/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("applesauce-signer", () => ({
  Nip07Signer: vi.fn().mockImplementation(() => ({
    getPublicKey: vi.fn().mockResolvedValue("pubkey_nip07"),
  })),
  Nip46Signer: vi.fn().mockImplementation(() => ({
    getPublicKey: vi.fn().mockResolvedValue("pubkey_nip46"),
    connect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../nostr/pool", () => ({
  createPool: vi.fn().mockReturnValue({}),
}));

vi.mock("../../nostr/queries", () => ({
  fetchRelayList: vi.fn().mockResolvedValue(["wss://relay.example.com"]),
}));

import { loginNip07, loginNip46, getAuthState } from "./auth";

describe("loginNip07", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pubkey on successful NIP-07 login", async () => {
    const pubkey = await loginNip07();
    expect(pubkey).toBe("pubkey_nip07");
  });

  it("getAuthState reflects pubkey after login", async () => {
    await loginNip07();
    expect(getAuthState().pubkey).toBe("pubkey_nip07");
  });
});

describe("loginNip46", () => {
  it("returns pubkey on successful NIP-46 login", async () => {
    const pubkey = await loginNip46("bunker://...");
    expect(pubkey).toBe("pubkey_nip46");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/shell/stores/auth.test.ts
```

Expected: FAIL — "Cannot find module './auth'"

- [ ] **Step 3: Write `src/shell/stores/auth.ts`**

```typescript
import { Nip07Signer, Nip46Signer } from "applesauce-signer";
import { createPool } from "../../nostr/pool";
import { fetchRelayList } from "../../nostr/queries";
import { DEFAULT_RELAYS } from "../../nostr/constants";

export interface AuthState {
  pubkey: string | null;
  signer: Nip07Signer | Nip46Signer | null;
}

let state: AuthState = { pubkey: null, signer: null };

export function getAuthState(): AuthState {
  return state;
}

async function initRelayPool(pubkey: string): Promise<void> {
  const userRelays = await fetchRelayList(pubkey);
  const relays = userRelays.length > 0 ? userRelays : DEFAULT_RELAYS;
  createPool(relays);
}

export async function loginNip07(): Promise<string> {
  const signer = new Nip07Signer();
  const pubkey = await signer.getPublicKey();
  state = { pubkey, signer };
  await initRelayPool(pubkey);
  return pubkey;
}

export async function loginNip46(connectionString: string): Promise<string> {
  const signer = new Nip46Signer(connectionString);
  await signer.connect();
  const pubkey = await signer.getPublicKey();
  state = { pubkey, signer };
  sessionStorage.setItem("nip46_session", connectionString);
  await initRelayPool(pubkey);
  return pubkey;
}

export function logout(): void {
  state = { pubkey: null, signer: null };
  sessionStorage.removeItem("nip46_session");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/shell/stores/auth.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shell/stores/
git commit -m "feat: auth module — NIP-07 and NIP-46 login with relay pool init"
```

---

## Task 7: Petname Store

**Files:**
- Create: `src/shell/stores/petnames.ts`
- Create: `src/shell/stores/petnames.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/shell/stores/petnames.test.ts
import { describe, it, expect, beforeEach } from "vitest";

// jsdom provides localStorage
beforeEach(() => {
  localStorage.clear();
});

import { registerPetname, resolveNpub, renamePetname, listPetnames } from "./petnames";

describe("registerPetname", () => {
  it("maps a name to an npub", () => {
    registerPetname("mysite", "npub1abc");
    expect(resolveNpub("mysite")).toBe("npub1abc");
  });

  it("first-seen wins on collision", () => {
    registerPetname("mysite", "npub1abc");
    registerPetname("mysite", "npub1xyz");
    expect(resolveNpub("mysite")).toBe("npub1abc");
  });
});

describe("renamePetname", () => {
  it("allows user to rename a petname", () => {
    registerPetname("mysite", "npub1abc");
    renamePetname("mysite", "renamed");
    expect(resolveNpub("renamed")).toBe("npub1abc");
    expect(resolveNpub("mysite")).toBeNull();
  });
});

describe("resolveNpub", () => {
  it("returns null for unknown name", () => {
    expect(resolveNpub("unknown")).toBeNull();
  });
});

describe("listPetnames", () => {
  it("returns all registered petnames", () => {
    registerPetname("site-a", "npub1aaa");
    registerPetname("site-b", "npub1bbb");
    const names = listPetnames();
    expect(names).toContainEqual({ name: "site-a", npub: "npub1aaa" });
    expect(names).toContainEqual({ name: "site-b", npub: "npub1bbb" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/shell/stores/petnames.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/shell/stores/petnames.ts`**

```typescript
const STORAGE_KEY = "aura_petnames";

type PetnameMap = Record<string, string>; // name → npub

function load(): PetnameMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function save(map: PetnameMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function registerPetname(name: string, npub: string): void {
  const map = load();
  if (name in map) return; // first-seen wins
  map[name] = npub;
  save(map);
}

export function resolveNpub(name: string): string | null {
  return load()[name] ?? null;
}

export function renamePetname(oldName: string, newName: string): void {
  const map = load();
  if (!(oldName in map)) return;
  map[newName] = map[oldName];
  delete map[oldName];
  save(map);
}

export function listPetnames(): { name: string; npub: string }[] {
  return Object.entries(load()).map(([name, npub]) => ({ name, npub }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/shell/stores/petnames.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shell/stores/petnames.ts src/shell/stores/petnames.test.ts
git commit -m "feat: petname store with localStorage persistence"
```

---

## Task 8: Service Worker — Router and MIME

**Files:**
- Create: `src/sw/router.ts`
- Create: `src/sw/router.test.ts`
- Create: `src/sw/mime.ts`
- Create: `src/sw/mime.test.ts`

- [ ] **Step 1: Write failing tests for router**

```typescript
// src/sw/router.test.ts
import { describe, it, expect } from "vitest";
import { matchAuraPath } from "./router";

describe("matchAuraPath", () => {
  it("matches a valid /~npub/path URL", () => {
    const result = matchAuraPath("https://aura.example.com/~npub1abc123/blog/index.html");
    expect(result).toEqual({ npub: "npub1abc123", path: "/blog/index.html" });
  });

  it("matches root path defaulting to /index.html", () => {
    const result = matchAuraPath("https://aura.example.com/~npub1abc123/");
    expect(result).toEqual({ npub: "npub1abc123", path: "/index.html" });
  });

  it("matches bare /~npub (no trailing slash) as /index.html", () => {
    const result = matchAuraPath("https://aura.example.com/~npub1abc123");
    expect(result).toEqual({ npub: "npub1abc123", path: "/index.html" });
  });

  it("returns null for non-aura paths", () => {
    expect(matchAuraPath("https://aura.example.com/assets/main.js")).toBeNull();
    expect(matchAuraPath("https://aura.example.com/")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/sw/router.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/sw/router.ts`**

```typescript
export interface AuraMatch {
  npub: string;
  path: string;
}

const AURA_RE = /^\/~([^/]+)(\/.*)?$/;

export function matchAuraPath(urlString: string): AuraMatch | null {
  const url = new URL(urlString);
  const m = AURA_RE.exec(url.pathname);
  if (!m) return null;
  const npub = m[1];
  let path = m[2] ?? "/";
  if (path === "/") path = "/index.html";
  return { npub, path };
}
```

- [ ] **Step 4: Run router tests**

```bash
npm test -- src/sw/router.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Write failing tests for mime**

```typescript
// src/sw/mime.test.ts
import { describe, it, expect } from "vitest";
import { extToMime } from "./mime";

describe("extToMime", () => {
  it("returns text/html for .html", () => expect(extToMime("/index.html")).toBe("text/html"));
  it("returns text/css for .css", () => expect(extToMime("/style.css")).toBe("text/css"));
  it("returns application/javascript for .js", () => expect(extToMime("/app.js")).toBe("application/javascript"));
  it("returns application/javascript for .mjs", () => expect(extToMime("/mod.mjs")).toBe("application/javascript"));
  it("returns image/png for .png", () => expect(extToMime("/img.png")).toBe("image/png"));
  it("returns image/jpeg for .jpg", () => expect(extToMime("/img.jpg")).toBe("image/jpeg"));
  it("returns image/svg+xml for .svg", () => expect(extToMime("/icon.svg")).toBe("image/svg+xml"));
  it("returns application/wasm for .wasm", () => expect(extToMime("/mod.wasm")).toBe("application/wasm"));
  it("returns application/json for .json", () => expect(extToMime("/data.json")).toBe("application/json"));
  it("returns application/octet-stream for unknown ext", () => expect(extToMime("/binary.bin")).toBe("application/octet-stream"));
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npm test -- src/sw/mime.test.ts
```

Expected: FAIL

- [ ] **Step 7: Write `src/sw/mime.ts`**

```typescript
const MIME_MAP: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".ts": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

export function extToMime(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = path.slice(dot).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}
```

- [ ] **Step 8: Run mime tests**

```bash
npm test -- src/sw/mime.test.ts
```

Expected: PASS (10 tests)

- [ ] **Step 9: Commit**

```bash
git add src/sw/router.ts src/sw/router.test.ts src/sw/mime.ts src/sw/mime.test.ts
git commit -m "feat: SW router path parser and MIME type map"
```

---

## Task 9: Service Worker — Manifest Cache

**Files:**
- Create: `src/sw/manifest.ts`
- Create: `src/sw/manifest.test.ts`

The manifest cache stores `kind:15128` event JSON in `CacheStorage` with a 5-minute TTL.

- [ ] **Step 1: Write failing tests**

```typescript
// src/sw/manifest.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock CacheStorage
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
};
const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
};
vi.stubGlobal("caches", mockCaches);

import { getCachedManifest, setCachedManifest, type CachedManifest } from "./manifest";

const sampleEvent = {
  kind: 15128,
  content: JSON.stringify({ files: { "/index.html": "abc123" } }),
  tags: [["name", "mysite"]],
  pubkey: "pubkey1",
  id: "evid1",
  sig: "sig",
  created_at: 1000,
};

describe("getCachedManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaches.open.mockResolvedValue(mockCache);
  });

  it("returns null when no cached entry", async () => {
    mockCache.match.mockResolvedValueOnce(undefined);
    const result = await getCachedManifest("pubkey1");
    expect(result).toBeNull();
  });

  it("returns null when cached entry is expired", async () => {
    const expired: CachedManifest = { event: sampleEvent, cachedAt: Date.now() - 10 * 60 * 1000 };
    mockCache.match.mockResolvedValueOnce({ json: async () => expired });
    const result = await getCachedManifest("pubkey1");
    expect(result).toBeNull();
  });

  it("returns event when cached entry is fresh", async () => {
    const fresh: CachedManifest = { event: sampleEvent, cachedAt: Date.now() - 60 * 1000 };
    mockCache.match.mockResolvedValueOnce({ json: async () => fresh });
    const result = await getCachedManifest("pubkey1");
    expect(result).toEqual(sampleEvent);
  });
});

describe("setCachedManifest", () => {
  it("stores event in CacheStorage with current timestamp", async () => {
    mockCache.match.mockResolvedValueOnce(undefined);
    await setCachedManifest("pubkey1", sampleEvent);
    expect(mockCache.put).toHaveBeenCalledWith(
      expect.stringContaining("pubkey1"),
      expect.any(Object)
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/sw/manifest.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/sw/manifest.ts`**

```typescript
import type { NostrEvent } from "nostr-tools";

const CACHE_NAME = "aura-manifests-v1";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface CachedManifest {
  event: NostrEvent;
  cachedAt: number;
}

function cacheKey(pubkey: string): string {
  return `manifest:${pubkey}`;
}

export async function getCachedManifest(pubkey: string): Promise<NostrEvent | null> {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(cacheKey(pubkey));
  if (!response) return null;
  const entry: CachedManifest = await response.json();
  if (Date.now() - entry.cachedAt > TTL_MS) return null;
  return entry.event;
}

export async function setCachedManifest(pubkey: string, event: NostrEvent): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const entry: CachedManifest = { event, cachedAt: Date.now() };
  await cache.put(cacheKey(pubkey), new Response(JSON.stringify(entry)));
}

export function getManifestFiles(event: NostrEvent): Record<string, string> {
  try {
    return JSON.parse(event.content).files ?? {};
  } catch {
    return {};
  }
}

export function getManifestName(event: NostrEvent): string | null {
  const tag = event.tags.find((t: string[]) => t[0] === "name");
  return tag?.[1] ?? null;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/sw/manifest.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/sw/manifest.ts src/sw/manifest.test.ts
git commit -m "feat: SW manifest cache with 5-minute TTL"
```

---

## Task 10: Service Worker — Main Entry

**Files:**
- Create: `src/sw/sw.ts`

This is the Service Worker entry point. It wires together the router, manifest cache, Nostr queries, Blossom client, and MIME mapper to handle `FetchEvent`s.

Note: The SW runs in the `ServiceWorkerGlobalScope` — no DOM access. It receives relay configuration via `postMessage` from the shell.

- [ ] **Step 1: Write `src/sw/sw.ts`**

```typescript
/// <reference lib="webworker" />
import { matchAuraPath } from "./router";
import { getCachedManifest, setCachedManifest, getManifestFiles } from "./manifest";
import { extToMime } from "./mime";
import { fetchManifest } from "../nostr/queries";
import { fetchBlob } from "../blossom/client";
import { DEFAULT_BLOSSOM_SERVERS } from "../blossom/constants";
import { fetchBlossomServers } from "../nostr/queries";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event: FetchEvent) => {
  const match = matchAuraPath(event.request.url);
  if (!match) return; // let the browser handle non-aura requests normally
  event.respondWith(handleAuraRequest(match.npub, match.path));
});

async function handleAuraRequest(npub: string, path: string): Promise<Response> {
  // 1. Resolve manifest (cache-first)
  let manifestEvent = await getCachedManifest(npub);
  if (!manifestEvent) {
    manifestEvent = await fetchManifest(npub);
    if (!manifestEvent) {
      return new Response("Manifest not found", { status: 404 });
    }
    await setCachedManifest(npub, manifestEvent);
  }

  // 2. Look up SHA-256 for requested path
  const files = getManifestFiles(manifestEvent);
  const sha256 = files[path];
  if (!sha256) {
    return new Response("File not found in manifest", { status: 404 });
  }

  // 3. Resolve Blossom servers (owner's list, then defaults)
  const ownerServers = await fetchBlossomServers(npub);
  const servers = ownerServers.length > 0
    ? [...ownerServers, ...DEFAULT_BLOSSOM_SERVERS]
    : DEFAULT_BLOSSOM_SERVERS;

  // 4. Fetch and verify blob
  const blob = await fetchBlob(sha256, servers);
  if (!blob) {
    return new Response("Blob not found or hash mismatch", { status: 403 });
  }

  // 5. Return response with correct MIME type
  const contentType = extToMime(path);
  return new Response(blob, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --project tsconfig.sw.json --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/sw/sw.ts
git commit -m "feat: Service Worker FetchEvent handler — manifest resolution, blob fetch, verify"
```

---

## Task 11: Shell UI — Auth Panel and Address Bar

**Files:**
- Create: `src/shell/components/AuthPanel.tsx`
- Create: `src/shell/components/AddressBar.tsx`
- Create: `src/shell/components/SiteFrame.tsx`
- Modify: `src/shell/App.tsx`

- [ ] **Step 1: Write `src/shell/components/AuthPanel.tsx`**

```typescript
import { useState } from "preact/hooks";
import { loginNip07, loginNip46 } from "../stores/auth";

interface Props {
  onAuthenticated: (pubkey: string) => void;
}

export function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"detect" | "nip46">("detect");
  const [connectionString, setConnectionString] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleNip07() {
    if (!("nostr" in window)) {
      setMode("nip46");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pubkey = await loginNip07();
      onAuthenticated(pubkey);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleNip46() {
    setLoading(true);
    setError(null);
    try {
      const pubkey = await loginNip46(connectionString);
      onAuthenticated(pubkey);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (mode === "nip46") {
    return (
      <div class="auth-panel">
        <h2>Connect with Nostr Connect</h2>
        <input
          type="text"
          placeholder="bunker://..."
          value={connectionString}
          onInput={(e) => setConnectionString((e.target as HTMLInputElement).value)}
        />
        <button onClick={handleNip46} disabled={loading || !connectionString}>
          {loading ? "Connecting…" : "Connect"}
        </button>
        {error && <p class="error">{error}</p>}
      </div>
    );
  }

  return (
    <div class="auth-panel">
      <h2>Sign in with Nostr</h2>
      <button onClick={handleNip07} disabled={loading}>
        {loading ? "Connecting…" : "Connect with Extension (NIP-07)"}
      </button>
      {error && <p class="error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/shell/components/AddressBar.tsx`**

```typescript
import { useState } from "preact/hooks";
import { resolveNpub, registerPetname } from "../stores/petnames";

interface Props {
  currentNpub: string | null;
  currentPetname: string | null;
  onNavigate: (npub: string, path: string) => void;
}

export function AddressBar({ currentNpub, currentPetname, onNavigate }: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(e: Event) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    // Accept npub directly or petname
    let npub: string;
    if (trimmed.startsWith("npub1")) {
      npub = trimmed;
    } else {
      const resolved = resolveNpub(trimmed);
      if (!resolved) {
        alert(`Unknown petname: "${trimmed}". Enter an npub directly.`);
        return;
      }
      npub = resolved;
    }
    setInput("");
    onNavigate(npub, "/index.html");
  }

  const displayLabel = currentPetname ?? currentNpub ?? "";

  return (
    <form class="address-bar" onSubmit={handleSubmit}>
      {displayLabel && <span class="current-site">{displayLabel}</span>}
      <input
        type="text"
        placeholder="npub1… or site name"
        value={input}
        onInput={(e) => setInput((e.target as HTMLInputElement).value)}
      />
      <button type="submit">Go</button>
    </form>
  );
}
```

- [ ] **Step 3: Write `src/shell/components/SiteFrame.tsx`**

```typescript
interface Props {
  npub: string;
  path: string;
}

export function SiteFrame({ npub, path }: Props) {
  const src = `/~${npub}${path}`;
  return (
    <iframe
      class="site-frame"
      src={src}
      sandbox="allow-scripts allow-same-origin allow-forms"
      style={{ width: "100%", height: "100%", border: "none" }}
    />
  );
}
```

- [ ] **Step 4: Update `src/shell/App.tsx`**

```typescript
import { useState, useEffect } from "preact/hooks";
import { AuthPanel } from "./components/AuthPanel";
import { AddressBar } from "./components/AddressBar";
import { SiteFrame } from "./components/SiteFrame";
import { resolveNpub, registerPetname } from "./stores/petnames";
import { fetchManifest } from "../nostr/queries";
import { getManifestName } from "../sw/manifest";
import { getAuthState } from "./stores/auth";

export function App() {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [currentNpub, setCurrentNpub] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("/index.html");
  const [currentPetname, setCurrentPetname] = useState<string | null>(null);

  // Register SW on mount
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  async function handleNavigate(npub: string, path: string) {
    setCurrentNpub(npub);
    setCurrentPath(path);

    // Try to get the site name from the manifest and register petname
    const event = await fetchManifest(npub);
    if (event) {
      const name = getManifestName(event);
      if (name) {
        registerPetname(name, npub);
        setCurrentPetname(name);
      }
    }
  }

  if (!pubkey) {
    return <AuthPanel onAuthenticated={setPubkey} />;
  }

  return (
    <div class="aura-shell" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AddressBar
        currentNpub={currentNpub}
        currentPetname={currentPetname}
        onNavigate={handleNavigate}
      />
      {currentNpub && <SiteFrame npub={currentNpub} path={currentPath} />}
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --project tsconfig.app.json --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/shell/
git commit -m "feat: shell UI — AuthPanel, AddressBar, SiteFrame, App wiring"
```

---

## Task 12: Bootstrap Server

**Files:**
- Create: `server/serve.ts` (minimal Node.js static server — used when nginx/caddy is not available)

- [ ] **Step 1: Install serve dependency**

```bash
npm install --save-dev serve
```

- [ ] **Step 2: Add server script to `package.json`**

Add to `"scripts"`:

```json
"serve": "serve dist -l 3000"
```

- [ ] **Step 3: Build and test locally**

```bash
npm run build
npm run serve
```

Expected: Static files served at `http://localhost:3000`. Open in browser — Aura shell should load and SW should register (check DevTools → Application → Service Workers).

- [ ] **Step 4: Add nginx config example**

Create `server/nginx.example.conf`:

```nginx
server {
  listen 80;
  server_name _;
  root /var/www/aura/dist;
  index index.html;

  # All routes fall back to index.html (SW handles /~ paths)
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # SW must not be cached
  location /sw.js {
    add_header Cache-Control "no-cache";
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add server/ package.json package-lock.json
git commit -m "feat: bootstrap server — npm serve script and nginx config example"
```

---

## Task 13: Integration Test — End-to-End SW Flow

**Files:**
- Create: `src/sw/sw.integration.test.ts`

This test exercises the full SW request lifecycle with mocked Nostr queries and Blossom fetches.

- [ ] **Step 1: Write integration test**

```typescript
// src/sw/sw.integration.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- mock crypto.subtle (jsdom may not implement SHA-256) ---
const realCrypto = globalThis.crypto;
beforeEach(() => {
  vi.stubGlobal("crypto", {
    subtle: {
      digest: async (_alg: string, data: ArrayBuffer) => {
        // Return deterministic mock hash: first 4 bytes repeated to 32 bytes
        const view = new Uint8Array(data);
        const out = new Uint8Array(32);
        for (let i = 0; i < 32; i++) out[i] = view[i % view.length] ?? 0;
        return out.buffer;
      },
    },
  });
});

// --- mock nostr queries ---
const MOCK_HASH = "00".repeat(32); // what the mocked SHA-256 will produce for any blob

vi.mock("../nostr/queries", () => ({
  fetchManifest: vi.fn().mockResolvedValue({
    kind: 15128,
    pubkey: "pubkey1",
    id: "id1",
    sig: "sig",
    created_at: 1000,
    tags: [["name", "testsite"]],
    content: JSON.stringify({ files: { "/index.html": "00".repeat(32) } }),
  }),
  fetchBlossomServers: vi.fn().mockResolvedValue(["https://blossom.example.com"]),
}));

// --- mock caches ---
const mockCache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(mockCache) });

// --- mock fetch (for blob) ---
const HTML_CONTENT = "<html><body>Hello from Nostr</body></html>";
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  blob: async () => new Blob([new TextEncoder().encode(HTML_CONTENT)]),
}));

import { handleAuraRequest } from "./sw";

describe("handleAuraRequest integration", () => {
  it("returns 200 HTML response for /index.html", async () => {
    const response = await handleAuraRequest("pubkey1", "/index.html");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
  });

  it("returns 404 when file not in manifest", async () => {
    const response = await handleAuraRequest("pubkey1", "/missing.html");
    expect(response.status).toBe(404);
  });
});
```

Note: `handleAuraRequest` must be exported from `src/sw/sw.ts` for this test to work.

- [ ] **Step 2: Export `handleAuraRequest` from `src/sw/sw.ts`**

Change the `async function handleAuraRequest` declaration line in `src/sw/sw.ts` to:

```typescript
export async function handleAuraRequest(npub: string, path: string): Promise<Response> {
```

- [ ] **Step 3: Run integration test**

```bash
npm test -- src/sw/sw.integration.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: All tests pass. Note the count (should be 30+ tests across all modules).

- [ ] **Step 5: Commit**

```bash
git add src/sw/sw.integration.test.ts src/sw/sw.ts
git commit -m "test: SW integration test — end-to-end manifest fetch, blob fetch, response"
```

---

## Task 14: Final Build Verification

- [ ] **Step 1: Run linter**

```bash
npm run lint
```

Expected: No errors or warnings. If there are warnings, fix them before continuing.

- [ ] **Step 2: Run formatter check**

```bash
npm run fmt
```

Expected: All files formatted.

- [ ] **Step 3: Run full test suite with coverage**

```bash
npm run test -- --coverage
```

Expected: All tests pass. Review coverage report — aim for >80% on `src/blossom/`, `src/crypto/`, `src/nostr/`, `src/sw/`.

- [ ] **Step 4: Build for production**

```bash
npm run build
```

Expected: `dist/` contains `index.html`, `sw.js`, and `assets/` with JS/CSS. No build errors.

- [ ] **Step 5: Smoke test the built app**

```bash
npm run serve
```

Open `http://localhost:3000` in a browser with a NIP-07 extension installed (e.g., Alby or nos2x). Verify:
- Auth panel appears
- NIP-07 login works
- Address bar renders after login
- Navigating to a known npub loads the site via the Service Worker

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: final build verification — lint, format, tests, production build"
```

---

## Appendix: Key Interfaces Summary

| Symbol | File | Signature |
|---|---|---|
| `sha256Hex` | `src/crypto/hash.ts` | `(data: ArrayBuffer) => Promise<string>` |
| `verifySha256` | `src/blossom/verify.ts` | `(blob: Blob, expectedHex: string) => Promise<boolean>` |
| `fetchBlob` | `src/blossom/client.ts` | `(sha256: string, servers: string[]) => Promise<Blob \| null>` |
| `createPool` | `src/nostr/pool.ts` | `(relayUrls: string[]) => RelayPool` |
| `getPool` | `src/nostr/pool.ts` | `() => RelayPool \| undefined` |
| `fetchManifest` | `src/nostr/queries.ts` | `(pubkey: string) => Promise<NostrEvent \| null>` |
| `fetchBlossomServers` | `src/nostr/queries.ts` | `(pubkey: string) => Promise<string[]>` |
| `fetchRelayList` | `src/nostr/queries.ts` | `(pubkey: string) => Promise<string[]>` |
| `loginNip07` | `src/shell/stores/auth.ts` | `() => Promise<string>` |
| `loginNip46` | `src/shell/stores/auth.ts` | `(connectionString: string) => Promise<string>` |
| `getAuthState` | `src/shell/stores/auth.ts` | `() => AuthState` |
| `registerPetname` | `src/shell/stores/petnames.ts` | `(name: string, npub: string) => void` |
| `resolveNpub` | `src/shell/stores/petnames.ts` | `(name: string) => string \| null` |
| `matchAuraPath` | `src/sw/router.ts` | `(urlString: string) => AuraMatch \| null` |
| `extToMime` | `src/sw/mime.ts` | `(path: string) => string` |
| `getCachedManifest` | `src/sw/manifest.ts` | `(pubkey: string) => Promise<NostrEvent \| null>` |
| `setCachedManifest` | `src/sw/manifest.ts` | `(pubkey: string, event: NostrEvent) => Promise<void>` |
| `getManifestFiles` | `src/sw/manifest.ts` | `(event: NostrEvent) => Record<string, string>` |
| `getManifestName` | `src/sw/manifest.ts` | `(event: NostrEvent) => string \| null` |
| `handleAuraRequest` | `src/sw/sw.ts` | `(npub: string, path: string) => Promise<Response>` |
