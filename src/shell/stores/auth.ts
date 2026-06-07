import { RelayPool } from "applesauce-relay";
import {
  ExtensionSigner,
  NostrConnectSigner,
  SimpleSigner,
} from "applesauce-signer";
import { type EventTemplate, nip19 } from "nostr-tools";
import { DEFAULT_RELAYS } from "../../nostr/constants";
import { putEvents } from "../../nostr/event-store";
import {
  createPool,
  getPool,
  getPoolRelayUrls,
  mergeRelayUrls,
} from "../../nostr/pool";
import { fetchFollowingList, fetchRelayList } from "../../nostr/queries";
import { startEventSync, stopEventSync } from "../../nostr/sync";
import { getSettingsState } from "./settings";

export interface AuthState {
  pubkey: string | null;
  signer: ExtensionSigner | NostrConnectSigner | SimpleSigner | null;
  following: string[];
}

const SESSION_KEY = "nip46_session";
const PUBKEY_KEY = "aura_pubkey";

let state: AuthState = {
  pubkey: null,
  signer: null,
  following: [],
};

export function loadPersistedPubkey(): string | null {
  try {
    return sessionStorage.getItem(PUBKEY_KEY);
  } catch {
    return null;
  }
}

function persistPubkey(pubkey: string): void {
  sessionStorage.setItem(PUBKEY_KEY, pubkey);
}

export function getAuthState(): AuthState {
  return state;
}

export function formatNip07Error(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message : String(caught);
  if (raw.includes("Receiving end does not exist")) {
    return "The extension is installed but not responding on this page. In nos2x, allow this site and reload, then try again.";
  }
  if (raw.includes("Could not establish connection")) {
    return "The extension could not connect. Check that nos2x is enabled for this site and reload the page.";
  }
  return raw;
}

async function restoreSignerIfNeeded(): Promise<
  ExtensionSigner | NostrConnectSigner | SimpleSigner
> {
  if (state.signer) {
    return state.signer;
  }

  const persistedPubkey = state.pubkey ?? loadPersistedPubkey();
  const sessionConnection = sessionStorage.getItem(SESSION_KEY);

  if (sessionConnection) {
    const pool = new RelayPool();
    for (const relayUrl of DEFAULT_RELAYS) {
      pool.relay(relayUrl);
    }

    const signer = await NostrConnectSigner.fromBunkerURI(
      sessionConnection,
      pool as unknown as Parameters<typeof NostrConnectSigner.fromBunkerURI>[1],
      [],
    );
    const pubkey = await signer.getPublicKey();
    persistPubkey(pubkey);
    state = {
      pubkey,
      signer,
      following: state.following,
    };
    return signer;
  }

  if (!persistedPubkey) {
    throw new Error("Sign in before updating your blocklist.");
  }

  const signer = new ExtensionSigner();
  const pubkey = await signer.getPublicKey();
  persistPubkey(pubkey);
  state = {
    pubkey,
    signer,
    following: state.following,
  };
  return signer;
}

function createMuteListEvent(targetPubkey: string): EventTemplate {
  return {
    kind: 10000,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", targetPubkey]],
    content: "",
  };
}

function syncRelaySubscription(
  pubkey: string,
  following: string[] = state.following,
): void {
  const relayUrls = getPoolRelayUrls();
  const relays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;
  startEventSync(relays, {
    pubkey,
    following,
    mode: getSettingsState().relaySubscriptionMode,
  });
}

export async function primeRelayPool(pubkey: string): Promise<string[]> {
  createPool(DEFAULT_RELAYS);
  const userRelays = await fetchRelayList(pubkey);
  const relays = mergeRelayUrls(DEFAULT_RELAYS, userRelays);
  createPool(relays);
  syncRelaySubscription(pubkey);
  return relays;
}

async function loadFollowing(pubkey: string): Promise<string[]> {
  return fetchFollowingList(pubkey);
}

export async function loginNip07(): Promise<string> {
  const signer = new ExtensionSigner();
  const pubkey = await signer.getPublicKey();
  persistPubkey(pubkey);
  await primeRelayPool(pubkey);
  const following = await loadFollowing(pubkey);
  state = { pubkey, signer, following };
  syncRelaySubscription(pubkey, following);
  return pubkey;
}

export async function loginNip46(connectionString: string): Promise<string> {
  const pool = new RelayPool();
  for (const relayUrl of DEFAULT_RELAYS) {
    pool.relay(relayUrl);
  }

  const signer = await NostrConnectSigner.fromBunkerURI(
    connectionString,
    pool as unknown as Parameters<typeof NostrConnectSigner.fromBunkerURI>[1],
    [],
  );
  const pubkey = await signer.getPublicKey();
  sessionStorage.setItem(SESSION_KEY, connectionString);
  persistPubkey(pubkey);
  await primeRelayPool(pubkey);
  const following = await loadFollowing(pubkey);
  state = { pubkey, signer, following };
  syncRelaySubscription(pubkey, following);
  return pubkey;
}

export async function loginNsec(secretKeyInput: string): Promise<string> {
  const normalized = secretKeyInput.trim();
  const decoded = nip19.decode(normalized);
  if (decoded.type !== "nsec") {
    throw new Error("Expected an nsec secret key.");
  }

  const signer = new SimpleSigner(decoded.data);
  const pubkey = await signer.getPublicKey();
  persistPubkey(pubkey);
  await primeRelayPool(pubkey);
  const following = await loadFollowing(pubkey);
  state = { pubkey, signer, following };
  syncRelaySubscription(pubkey, following);
  return pubkey;
}

export async function publishMuteListEntry(
  targetPubkey: string,
): Promise<void> {
  const signer = await restoreSignerIfNeeded();
  const relayUrls = getPoolRelayUrls();
  const relays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;
  const pool = getPool() ?? createPool(relays);
  const signed = await signer.signEvent(createMuteListEvent(targetPubkey));

  await pool.publish(relays, signed);
  await putEvents([signed]);
}

export function refreshRelaySubscription(): void {
  if (!state.pubkey) return;
  syncRelaySubscription(state.pubkey);
}

export function logout(): void {
  stopEventSync();
  state = {
    pubkey: null,
    signer: null,
    following: [],
  };
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PUBKEY_KEY);
}
