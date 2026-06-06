import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
};
const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
};
vi.stubGlobal("caches", mockCaches);

import {
  AURA_MANIFEST_TAG_KEY,
  AURA_MANIFEST_TAG_VALUE,
  type CachedManifest,
  getCachedManifest,
  getCachedManifestEntry,
  getManifestFiles,
  getManifestName,
  isAuraManifestEvent,
  isCachedManifestFresh,
  parseManifestMetadata,
  setCachedManifest,
} from "./manifest";

const sampleEvent = {
  kind: 15128,
  content: JSON.stringify({
    files: { "/index.html": "abc123" },
    description: "A sample site",
    icon: "/icon.png",
    version: "1.2.3",
    start_path: "/index.html",
    theme_color: "#112233",
  }),
  tags: [
    [AURA_MANIFEST_TAG_KEY, AURA_MANIFEST_TAG_VALUE],
    ["name", "mysite"],
    ["description", "A sample site"],
    ["icon", "/icon.png"],
    ["version", "1.2.3"],
    ["start_path", "/index.html"],
    ["theme_color", "#112233"],
  ],
  pubkey: "pubkey1",
  id: "evid1",
  sig: "sig",
  created_at: 1000,
};

describe("manifest cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaches.open.mockResolvedValue(mockCache);
  });

  it("returns the cached entry even when expired", async () => {
    const expired: CachedManifest = {
      event: sampleEvent,
      cachedAt: Date.now() - 10 * 60 * 1000,
    };
    mockCache.match.mockResolvedValueOnce({ json: async () => expired });
    await expect(getCachedManifestEntry("pubkey1")).resolves.toEqual(expired);
  });

  it("returns null when no cached entry", async () => {
    mockCache.match.mockResolvedValueOnce(undefined);
    await expect(getCachedManifest("pubkey1")).resolves.toBeNull();
  });

  it("returns null when cached entry is expired", async () => {
    const expired: CachedManifest = {
      event: sampleEvent,
      cachedAt: Date.now() - 10 * 60 * 1000,
    };
    mockCache.match.mockResolvedValueOnce({ json: async () => expired });
    await expect(getCachedManifest("pubkey1")).resolves.toBeNull();
  });

  it("returns event when cached entry is fresh", async () => {
    const fresh: CachedManifest = {
      event: sampleEvent,
      cachedAt: Date.now() - 60 * 1000,
    };
    mockCache.match.mockResolvedValueOnce({ json: async () => fresh });
    await expect(getCachedManifest("pubkey1")).resolves.toEqual(sampleEvent);
  });

  it("detects fresh and stale cached entries", () => {
    const fresh: CachedManifest = {
      event: sampleEvent,
      cachedAt: Date.now() - 60 * 1000,
    };
    const stale: CachedManifest = {
      event: sampleEvent,
      cachedAt: Date.now() - 10 * 60 * 1000,
    };

    expect(isCachedManifestFresh(fresh)).toBe(true);
    expect(isCachedManifestFresh(stale)).toBe(false);
  });

  it("stores event in CacheStorage with current timestamp", async () => {
    await setCachedManifest("pubkey1", sampleEvent);
    expect(mockCache.put).toHaveBeenCalledWith(
      expect.stringContaining("pubkey1"),
      expect.any(Response),
    );
  });
});

describe("manifest parsing", () => {
  it("reads manifest metadata from tags and content", () => {
    expect(parseManifestMetadata(sampleEvent)).toEqual({
      name: "mysite",
      description: "A sample site",
      icon: "/icon.png",
      version: "1.2.3",
      startPath: "/index.html",
      themeColor: "#112233",
      files: { "/index.html": "abc123" },
    });
  });

  it("keeps backwards compatibility for file and name accessors", () => {
    expect(getManifestFiles(sampleEvent)).toEqual({
      "/index.html": "abc123",
    });
    expect(getManifestName(sampleEvent)).toBe("mysite");
  });

  it("recognizes Aura manifest events", () => {
    expect(isAuraManifestEvent(sampleEvent)).toBe(true);
  });

  it("falls back safely on malformed content", () => {
    const malformedEvent = {
      ...sampleEvent,
      content: "{not-json",
    };

    expect(parseManifestMetadata(malformedEvent)).toEqual({
      name: null,
      description: null,
      icon: null,
      version: null,
      startPath: "/index.html",
      themeColor: null,
      files: {},
    });
  });
});
