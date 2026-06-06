import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.fn();
const mockPool = {
  request,
  relays: new Map<string, unknown>(),
};

const mocks = vi.hoisted(() => {
  let cachedLatestEvent: unknown = null;
  const getLatestCachedEvent = vi.fn(() => Promise.resolve(cachedLatestEvent));
  const putEvents = vi.fn().mockResolvedValue(undefined);

  return {
    getLatestCachedEvent,
    putEvents,
    setCachedLatestEvent: (event: unknown) => {
      cachedLatestEvent = event;
    },
  };
});

vi.mock("./event-store", () => ({
  getLatestCachedEvent: mocks.getLatestCachedEvent,
  putEvents: mocks.putEvents,
}));

vi.mock("./pool", () => ({
  getPool: () => mockPool,
  getPoolRelayUrls: () => ["wss://relay.example.com"],
}));

import {
  fetchBlossomServers,
  fetchFollowingList,
  fetchManifest,
  fetchProfile,
  fetchRelayList,
} from "./queries";

beforeEach(() => {
  mocks.setCachedLatestEvent(null);
});

const mockEvent = (
  kind: number,
  content: string,
  tags: string[][],
  pubkey: string,
) => ({
  kind,
  content,
  tags,
  pubkey,
  id: "abc",
  sig: "sig",
  created_at: 1000,
});

describe("fetchManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setCachedLatestEvent(null);
  });

  it("returns the most recent kind:15128 event for a pubkey", async () => {
    const ev = mockEvent(
      15128,
      JSON.stringify({ files: [] }),
      [
        ["t", "aura-site"],
        ["name", "mysite"],
      ],
      "pubkey1",
    );
    request.mockReturnValueOnce({
      subscribe: (observer: {
        next?: (event: unknown) => void;
        complete?: () => void;
      }) => {
        observer.next?.(ev);
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchManifest("pubkey1")).resolves.toEqual(ev);
  });

  it("returns null when no event found", async () => {
    request.mockReturnValueOnce({
      subscribe: (observer: { complete?: () => void }) => {
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchManifest("pubkey1")).resolves.toBeNull();
  });

  it("returns cached manifest events before hitting relays", async () => {
    const ev = mockEvent(
      15128,
      JSON.stringify({ files: [] }),
      [
        ["t", "aura-site"],
        ["name", "mysite"],
      ],
      "pubkey1",
    );
    mocks.setCachedLatestEvent(ev);

    await expect(fetchManifest("pubkey1")).resolves.toEqual(ev);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("fetchProfile", () => {
  it("returns the most recent kind:0 event for a pubkey", async () => {
    const ev = mockEvent(
      0,
      JSON.stringify({ picture: "https://example.com/avatar.png" }),
      [],
      "pubkey1",
    );
    request.mockReturnValueOnce({
      subscribe: (observer: {
        next?: (event: unknown) => void;
        complete?: () => void;
      }) => {
        observer.next?.(ev);
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchProfile("pubkey1")).resolves.toEqual(ev);
  });

  it("returns null when no profile event is found", async () => {
    request.mockReturnValueOnce({
      subscribe: (observer: { complete?: () => void }) => {
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchProfile("pubkey1")).resolves.toBeNull();
  });
});

describe("fetchBlossomServers", () => {
  it("returns server URLs from BUD-03 tags", async () => {
    const ev = mockEvent(
      10063,
      "",
      [["server", "https://blossom.example.com"]],
      "pubkey1",
    );
    request.mockReturnValueOnce({
      subscribe: (observer: {
        next?: (event: unknown) => void;
        complete?: () => void;
      }) => {
        observer.next?.(ev);
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchBlossomServers("pubkey1")).resolves.toEqual([
      "https://blossom.example.com",
    ]);
  });

  it("returns empty array when no event found", async () => {
    request.mockReturnValueOnce({
      subscribe: (observer: { complete?: () => void }) => {
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchBlossomServers("pubkey1")).resolves.toEqual([]);
  });
});

describe("fetchRelayList", () => {
  it("returns relay URLs from NIP-65 tags", async () => {
    const ev = mockEvent(
      10002,
      "",
      [["r", "wss://relay.example.com"]],
      "pubkey1",
    );
    request.mockReturnValueOnce({
      subscribe: (observer: {
        next?: (event: unknown) => void;
        complete?: () => void;
      }) => {
        observer.next?.(ev);
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchRelayList("pubkey1")).resolves.toEqual([
      "wss://relay.example.com",
    ]);
  });

  it("returns empty array when no event found", async () => {
    request.mockReturnValueOnce({
      subscribe: (observer: { complete?: () => void }) => {
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchRelayList("pubkey1")).resolves.toEqual([]);
  });
});

describe("fetchFollowingList", () => {
  it("returns pubkeys from NIP-02 contact tags", async () => {
    const ev = mockEvent(
      3,
      "",
      [
        ["p", "followed1"],
        ["p", "followed2"],
        ["p", "followed1"],
      ],
      "pubkey1",
    );
    request.mockReturnValueOnce({
      subscribe: (observer: {
        next?: (event: unknown) => void;
        complete?: () => void;
      }) => {
        observer.next?.(ev);
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchFollowingList("pubkey1")).resolves.toEqual([
      "followed1",
      "followed2",
    ]);
  });

  it("returns empty array when no contact list exists", async () => {
    request.mockReturnValueOnce({
      subscribe: (observer: { complete?: () => void }) => {
        observer.complete?.();
        return { unsubscribe() {} };
      },
    });

    await expect(fetchFollowingList("pubkey1")).resolves.toEqual([]);
  });
});
