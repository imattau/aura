import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getPublicKey = vi.fn().mockResolvedValue("pubkey_nip07");
  const signEvent = vi.fn().mockImplementation(async (event: unknown) => ({
    ...(event as Record<string, unknown>),
    id: "signed_event",
    pubkey: "pubkey_nip07",
    sig: "sig",
  }));
  const nip46GetPublicKey = vi.fn().mockResolvedValue("pubkey_nip46");
  const nip46SignEvent = vi.fn().mockImplementation(async (event: unknown) => ({
    ...(event as Record<string, unknown>),
    id: "signed_event_nip46",
    pubkey: "pubkey_nip46",
    sig: "sig",
  }));
  const nsecGetPublicKey = vi.fn().mockResolvedValue("pubkey_nsec");
  const nsecSignEvent = vi.fn().mockImplementation(async (event: unknown) => ({
    ...(event as Record<string, unknown>),
    id: "signed_event_nsec",
    pubkey: "pubkey_nsec",
    sig: "sig",
  }));
  const publish = vi.fn().mockResolvedValue([]);
  const mockPool = {
    publish,
  };
  let currentPool: typeof mockPool | undefined = mockPool;
  let currentRelayUrls: string[] = ["wss://relay.example.com"];
  const fromBunkerURI = vi.fn().mockResolvedValue({
    getPublicKey: nip46GetPublicKey,
    signEvent: nip46SignEvent,
  });
  const simpleSignerMock = vi.fn().mockImplementation(() => ({
    getPublicKey: nsecGetPublicKey,
    signEvent: nsecSignEvent,
  }));
  const extensionSignerMock = vi.fn().mockImplementation(() => ({
    getPublicKey,
    signEvent,
  }));
  const createPool = vi.fn((relayUrls: string[]) => {
    currentPool = mockPool;
    currentRelayUrls = [...relayUrls];
    return mockPool;
  });
  const mergeRelayUrls = vi.fn((...relayGroups: string[][]) =>
    relayGroups.flat(),
  );
  const getPool = vi.fn(() => currentPool);
  const getPoolRelayUrls = vi.fn(() => currentRelayUrls);
  const fetchRelayList = vi.fn().mockResolvedValue(["wss://relay.example.com"]);
  const fetchFollowingList = vi.fn().mockResolvedValue(["followed_pubkey"]);
  const putEvents = vi.fn().mockResolvedValue(undefined);
  const nip19Decode = vi.fn().mockReturnValue({
    type: "nsec",
    data: new Uint8Array([1, 2, 3]),
  });

  return {
    getPublicKey,
    signEvent,
    nip46GetPublicKey,
    nip46SignEvent,
    nsecGetPublicKey,
    nsecSignEvent,
    fromBunkerURI,
    simpleSignerMock,
    extensionSignerMock,
    createPool,
    mergeRelayUrls,
    getPool,
    getPoolRelayUrls,
    fetchRelayList,
    fetchFollowingList,
    putEvents,
    publish,
    setCurrentPool: (pool: typeof mockPool | undefined) => {
      currentPool = pool;
    },
    setCurrentRelayUrls: (relayUrls: string[]) => {
      currentRelayUrls = relayUrls;
    },
    nip19Decode,
  };
});

vi.mock("applesauce-signer", () => ({
  ExtensionSigner: mocks.extensionSignerMock,
  SimpleSigner: mocks.simpleSignerMock,
  NostrConnectSigner: {
    fromBunkerURI: mocks.fromBunkerURI,
  },
}));

vi.mock("nostr-tools", () => ({
  nip19: {
    decode: mocks.nip19Decode,
  },
}));

vi.mock("../../nostr/pool", () => ({
  createPool: mocks.createPool,
  mergeRelayUrls: mocks.mergeRelayUrls,
  getPool: mocks.getPool,
  getPoolRelayUrls: mocks.getPoolRelayUrls,
}));

vi.mock("../../nostr/queries", () => ({
  fetchRelayList: mocks.fetchRelayList,
  fetchFollowingList: mocks.fetchFollowingList,
}));

vi.mock("../../nostr/event-store", () => ({
  putEvents: mocks.putEvents,
}));

vi.mock("../../nostr/sync", () => ({
  startEventSync: vi.fn(),
  stopEventSync: vi.fn(),
}));

import {
  formatNip07Error,
  getAuthState,
  loadPersistedPubkey,
  loginNip07,
  loginNip46,
  loginNsec,
  logout,
  publishMuteListEntry,
} from "./auth";
import { clearSettings } from "./settings";

describe("auth store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    clearSettings();
    logout();
  });

  it("returns pubkey on successful NIP-07 login", async () => {
    await expect(loginNip07()).resolves.toBe("pubkey_nip07");
    expect(mocks.extensionSignerMock).toHaveBeenCalledTimes(1);
    expect(getAuthState().pubkey).toBe("pubkey_nip07");
    expect(getAuthState().following).toEqual(["followed_pubkey"]);
    expect(sessionStorage.getItem("aura_pubkey")).toBe("pubkey_nip07");
    expect(mocks.mergeRelayUrls).toHaveBeenCalledWith(
      ["wss://relay.damus.io", "wss://relay.nostr.band", "wss://nos.lol"],
      ["wss://relay.example.com"],
    );
    expect(mocks.createPool).toHaveBeenNthCalledWith(1, [
      "wss://relay.damus.io",
      "wss://relay.nostr.band",
      "wss://nos.lol",
    ]);
    expect(mocks.createPool).toHaveBeenNthCalledWith(2, [
      "wss://relay.damus.io",
      "wss://relay.nostr.band",
      "wss://nos.lol",
      "wss://relay.example.com",
    ]);
  });

  it("returns pubkey on successful NIP-46 login", async () => {
    await expect(loginNip46("bunker://...")).resolves.toBe("pubkey_nip46");
    expect(mocks.fromBunkerURI).toHaveBeenCalledWith(
      "bunker://...",
      expect.anything(),
      [],
    );
    expect(sessionStorage.getItem("nip46_session")).toBe("bunker://...");
    expect(getAuthState().following).toEqual(["followed_pubkey"]);
  });

  it("returns pubkey on successful nsec login", async () => {
    await expect(loginNsec("nsec1example")).resolves.toBe("pubkey_nsec");
    expect(mocks.simpleSignerMock).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(sessionStorage.getItem("nip46_session")).toBeNull();
    expect(getAuthState().following).toEqual(["followed_pubkey"]);
  });

  it("logout clears active state and session storage", async () => {
    await loginNip46("bunker://...");
    logout();

    expect(getAuthState().pubkey).toBeNull();
    expect(sessionStorage.getItem("nip46_session")).toBeNull();
    expect(sessionStorage.getItem("aura_pubkey")).toBeNull();
  });

  it("loads a persisted pubkey from session storage", () => {
    sessionStorage.setItem("aura_pubkey", "pubkey_saved");
    expect(loadPersistedPubkey()).toBe("pubkey_saved");
  });

  it("formats common nos2x connection errors", () => {
    expect(
      formatNip07Error(
        new Error(
          "Could not establish connection. Receiving end does not exist.",
        ),
      ),
    ).toContain("nos2x");
  });

  it("publishes a mute list event when blocking a pubkey", async () => {
    await loginNip07();

    await publishMuteListEntry("a".repeat(64));

    expect(mocks.publish).toHaveBeenCalledTimes(1);
    const [relayUrls, event] = mocks.publish.mock.calls[0];
    expect(relayUrls).toEqual([
      "wss://relay.damus.io",
      "wss://relay.nostr.band",
      "wss://nos.lol",
      "wss://relay.example.com",
    ]);
    expect(event).toMatchObject({
      kind: 10000,
      tags: [["p", "a".repeat(64)]],
      content: "",
    });
    expect(mocks.putEvents).toHaveBeenCalledWith([event]);
  });

  it("restores the extension signer from persisted auth before publishing a mute list entry", async () => {
    logout();
    sessionStorage.setItem("aura_pubkey", "pubkey_nip07");

    await publishMuteListEntry("a".repeat(64));

    expect(mocks.getPublicKey).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(getAuthState().pubkey).toBe("pubkey_nip07");
    expect(getAuthState().signer).not.toBeNull();
  });
});
