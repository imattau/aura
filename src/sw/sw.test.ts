import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fetchBlob = vi.fn();
const fetchBlossomServers = vi.fn();
const fetchManifest = vi.fn();
const createPool = vi.fn();
const getCachedManifestEntry = vi.fn();
const isCachedManifestFresh = vi.fn();
const setCachedManifest = vi.fn();

vi.stubGlobal("self", {
  addEventListener: vi.fn(),
  clients: {
    claim: vi.fn(),
  },
  location: {
    origin: "https://aura.example.com",
  },
  skipWaiting: vi.fn(),
});

vi.mock("../blossom/client", () => ({
  fetchBlob,
}));

vi.mock("../blossom/constants", () => ({
  DEFAULT_BLOSSOM_SERVERS: ["https://blossom.example.com"],
}));

vi.mock("../demo/constants", () => ({
  DEMO_SITE_NPUB:
    "npub1aurademo0000000000000000000000000000000000000000000000000000",
}));

vi.mock("../nostr/constants", () => ({
  DEFAULT_RELAYS: ["wss://relay.example.com"],
}));

vi.mock("../nostr/pool", () => ({
  createPool,
}));

vi.mock("../nostr/queries", () => ({
  fetchBlossomServers,
  fetchManifest,
}));

vi.mock("./manifest", () => ({
  getCachedManifestEntry,
  getManifestFiles: (event: { content: string }) =>
    JSON.parse(event.content).files ?? {},
  isCachedManifestFresh,
  isAuraManifestEvent: (event: { tags?: string[][] }) =>
    event.tags?.some((tag) => tag[0] === "t" && tag[1] === "aura-site") ??
    false,
  setCachedManifest,
}));

vi.mock("./mime", () => ({
  extToMime: (path: string) => {
    if (path.endsWith(".html")) return "text/html";
    if (path.endsWith(".js")) return "text/javascript";
    return "application/octet-stream";
  },
}));

vi.mock("./router", () => ({
  matchAuraPath: vi.fn(),
}));

let handleAuraRequest: typeof import("./sw").handleAuraRequest;

beforeAll(async () => {
  ({ handleAuraRequest } = await import("./sw"));
});

beforeEach(() => {
  vi.clearAllMocks();
});

const staleManifest = {
  kind: 15128,
  content: JSON.stringify({
    files: {
      "/index.html": "stale-hash",
    },
  }),
  tags: [["t", "aura-site"]],
  pubkey: "pubkey1",
  id: "stale",
  sig: "sig",
  created_at: 1000,
};

const freshManifest = {
  kind: 15128,
  content: JSON.stringify({
    files: {
      "/index.html": "fresh-hash",
    },
  }),
  tags: [["t", "aura-site"]],
  pubkey: "pubkey1",
  id: "fresh",
  sig: "sig",
  created_at: 2000,
};

describe("handleAuraRequest", () => {
  it("serves a stale cached manifest and refreshes it in the background", async () => {
    getCachedManifestEntry.mockResolvedValueOnce({
      event: staleManifest,
      cachedAt: Date.now() - 10 * 60 * 1000,
    });
    isCachedManifestFresh.mockReturnValueOnce(false);
    fetchManifest.mockResolvedValueOnce(freshManifest);
    fetchBlossomServers.mockResolvedValueOnce([]);
    fetchBlob.mockResolvedValueOnce(
      new TextEncoder().encode("stale html") as unknown as Blob,
    );

    const pending: Promise<unknown>[] = [];
    const response = await handleAuraRequest(
      "pubkey1",
      "/index.html",
      (promise) => pending.push(promise),
    );

    expect(await response.text()).toBe("stale html");
    expect(fetchBlob).toHaveBeenCalledWith("stale-hash", [
      "https://blossom.example.com",
    ]);

    await Promise.all(pending);

    expect(fetchManifest).toHaveBeenCalledWith("pubkey1");
    expect(setCachedManifest).toHaveBeenCalledWith("pubkey1", freshManifest);
  });

  it("does not refresh when the cached manifest is fresh", async () => {
    getCachedManifestEntry.mockResolvedValueOnce({
      event: freshManifest,
      cachedAt: Date.now() - 60 * 1000,
    });
    isCachedManifestFresh.mockReturnValueOnce(true);
    fetchBlossomServers.mockResolvedValueOnce([]);
    fetchBlob.mockResolvedValueOnce(
      new TextEncoder().encode("fresh html") as unknown as Blob,
    );

    const pending: Promise<unknown>[] = [];
    const response = await handleAuraRequest(
      "pubkey1",
      "/index.html",
      (promise) => pending.push(promise),
    );

    expect(await response.text()).toBe("fresh html");
    expect(fetchManifest).not.toHaveBeenCalled();
    expect(pending).toHaveLength(0);
  });
});
