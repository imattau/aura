import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const request = vi.fn();
  const mockPool = {
    request,
    relays: new Map<string, unknown>(),
  };
  let currentPool: typeof mockPool | undefined = mockPool;
  const createPool = vi.fn((relayUrls: string[]) => {
    currentPool = mockPool;
    return mockPool;
  });
  const searchCachedDocuments = vi.fn(() => Promise.resolve([]));
  const putEvents = vi.fn().mockResolvedValue(undefined);

  return {
    request,
    mockPool,
    getCurrentPool: () => currentPool,
    setCurrentPool: (pool: typeof mockPool | undefined) => {
      currentPool = pool;
    },
    createPool,
    searchCachedDocuments,
    putEvents,
  };
});

vi.mock("./event-store", () => ({
  searchCachedDocuments: mocks.searchCachedDocuments,
  putEvents: mocks.putEvents,
}));

vi.mock("./pool", () => ({
  getPool: () => mocks.getCurrentPool(),
  getPoolRelayUrls: () => ["wss://relay.example.com"],
  createPool: mocks.createPool,
}));

import { searchNostrContent } from "./search";

const mockEvent = (
  kind: number,
  content: string,
  pubkey: string,
  created_at: number,
  tags: string[][] = [],
) => ({
  kind,
  content,
  tags: kind === 15128 ? [["t", "aura-site"], ...tags] : tags,
  pubkey,
  id: `${kind}-${created_at}`,
  sig: "sig",
  created_at,
});

describe("searchNostrContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setCurrentPool(mocks.mockPool);
  });

  it("returns Aura sites and Nostr content results", async () => {
    const site = mockEvent(
      15128,
      JSON.stringify({
        files: { "/index.html": "abc123" },
        description: "A sample site",
        start_path: "/index.html",
      }),
      "a".repeat(64),
      3000,
    );
    const note = mockEvent(1, "A note result", "b".repeat(64), 2000);
    const article = mockEvent(
      30023,
      "Article title\nArticle body",
      "c".repeat(64),
      1000,
    );
    const user = mockEvent(
      0,
      JSON.stringify({
        name: "Nostr Person",
        about: "sample profile",
      }),
      "e".repeat(64),
      500,
    );

    mocks.request.mockReturnValueOnce({
      subscribe: (observer: {
        next?: (event: unknown) => void;
        complete?: () => void;
      }) => {
        observer.next?.(site);
        observer.next?.(note);
        observer.next?.(article);
        observer.next?.(user);
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    const results = await searchNostrContent("sample");
    expect(results).toHaveLength(4);
    expect(results[0]).toMatchObject({
      id: "15128-3000",
      kind: 15128,
      kindLabel: "Aura site",
      title: "A sample site",
      summary: "A sample site",
      pubkey: "a".repeat(64),
      createdAt: 3000,
      resultKind: "site",
      path: "/index.html",
    });
    expect(results[0].npub).toMatch(/^npub1/);
    expect(results[1]).toMatchObject({
      id: "1-2000",
      kind: 1,
      kindLabel: "Note",
      title: "A note result",
      summary: "A note result",
      pubkey: "b".repeat(64),
      createdAt: 2000,
      resultKind: "note",
    });
    expect(results[1].npub).toMatch(/^npub1/);
    expect(results[2]).toMatchObject({
      id: "30023-1000",
      kind: 30023,
      kindLabel: "Article",
      title: "Article title",
      summary: "Article title Article body",
      pubkey: "c".repeat(64),
      createdAt: 1000,
      resultKind: "article",
    });
    expect(results[2].npub).toMatch(/^npub1/);
    expect(results[3]).toMatchObject({
      id: "0-500",
      kind: 0,
      kindLabel: "User",
      title: "Nostr Person",
      summary: "sample profile",
      pubkey: "e".repeat(64),
      createdAt: 500,
      resultKind: "user",
    });
    expect(results[3].npub).toMatch(/^npub1/);
  });

  it("initializes a default pool when no pool exists", async () => {
    mocks.setCurrentPool(undefined);
    mocks.request.mockReturnValueOnce({
      subscribe: (observer: {
        complete?: () => void;
      }) => {
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });
    mocks.request.mockReturnValueOnce({
      subscribe: (observer: {
        complete?: () => void;
      }) => {
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(searchNostrContent("sample")).resolves.toEqual([]);
    expect(mocks.createPool).toHaveBeenCalledWith([
      "wss://relay.damus.io",
      "wss://relay.nostr.band",
      "wss://nos.lol",
    ]);
  });

  it("falls back to locally matching recent events when search returns nothing", async () => {
    const fallbackSite = mockEvent(
      15128,
      JSON.stringify({
        files: { "/index.html": "abc123" },
        description: "A nostr site",
        start_path: "/index.html",
      }),
      "d".repeat(64),
      4000,
    );

    mocks.request
      .mockReturnValueOnce({
        subscribe: (observer: {
          complete?: () => void;
        }) => {
          observer.complete?.();
          return { unsubscribe() {} };
        },
      })
      .mockReturnValueOnce({
        subscribe: (observer: {
          next?: (event: unknown) => void;
          complete?: () => void;
        }) => {
          observer.next?.(fallbackSite);
          observer.complete?.();
          return { unsubscribe() {} };
        },
      });

    const results = await searchNostrContent("nostr");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "15128-4000",
      title: "A nostr site",
      resultKind: "site",
    });
  });

  it("returns cached matches even when relay search is empty", async () => {
    mocks.searchCachedDocuments.mockResolvedValueOnce([
      {
        id: "user:".concat("f".repeat(64)),
        kind: 0,
        kindLabel: "User",
        title: "Cached Person",
        summary: "cached profile",
        pubkey: "f".repeat(64),
        createdAt: 6000,
        resultKind: "user",
      },
    ]);
    mocks.request.mockReturnValueOnce({
      subscribe: (observer: {
        complete?: () => void;
      }) => {
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    const results = await searchNostrContent("cached");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "user:".concat("f".repeat(64)),
      kind: 0,
      kindLabel: "User",
      title: "Cached Person",
      summary: "cached profile",
      resultKind: "user",
    });
  });

  it("deduplicates logical site and user hits by pubkey", async () => {
    const sitePubkey = "a".repeat(64);
    const userPubkey = "b".repeat(64);

    mocks.searchCachedDocuments.mockResolvedValueOnce([
      {
        id: "site:".concat(sitePubkey),
        kind: 15128,
        kindLabel: "Aura site",
        title: "Cached site",
        summary: "Cached site",
        pubkey: sitePubkey,
        createdAt: 1000,
        resultKind: "site",
        path: "/index.html",
      },
      {
        id: "user:".concat(userPubkey),
        kind: 0,
        kindLabel: "User",
        title: "Cached Person",
        summary: "cached profile",
        pubkey: userPubkey,
        createdAt: 1200,
        resultKind: "user",
      },
    ]);

    const newerSite = mockEvent(
      15128,
      JSON.stringify({
        files: { "/index.html": "def456" },
        description: "Newer site",
        start_path: "/index.html",
      }),
      sitePubkey,
      2000,
    );
    const newerUser = mockEvent(
      0,
      JSON.stringify({
        name: "Newer Person",
        about: "newer profile",
      }),
      userPubkey,
      2200,
    );

    mocks.request.mockReturnValueOnce({
      subscribe: (observer: {
        next?: (event: unknown) => void;
        complete?: () => void;
      }) => {
        observer.next?.(newerSite);
        observer.next?.(newerUser);
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    const results = await searchNostrContent("site");
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      title: "Cached site",
      pubkey: sitePubkey,
      resultKind: "site",
    });
    expect(results[1]).toMatchObject({
      title: "Cached Person",
      pubkey: userPubkey,
      resultKind: "user",
    });
  });
});
