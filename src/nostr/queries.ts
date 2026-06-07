import type { NostrEvent } from "nostr-tools";
import {
  AURA_MANIFEST_TAG_VALUE,
  isAuraManifestEvent,
  parseManifestMetadata,
} from "../sw/manifest";
import { DEFAULT_RELAYS } from "./constants";
import {
  getCachedEventById,
  getLatestCachedEvent,
  getRecentCachedEvents,
  putEvents,
} from "./event-store";
import { getPool, getPoolRelayUrls } from "./pool";

type SimpleFilter = {
  kinds: number[];
  authors: string[];
  limit: number;
  "#t"?: string[];
};

type RawNostrFilter = Record<string, unknown>;

async function queryLatest(filter: SimpleFilter): Promise<NostrEvent | null> {
  const cached = await getLatestCachedEvent({
    kinds: filter.kinds,
    authors: filter.authors,
  });
  if (cached) {
    if (!filter["#t"] || isAuraManifestEvent(cached)) return cached;
  }

  const pool = getPool();
  if (!pool) return null;

  const relayUrls = getPoolRelayUrls();
  const relays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;
  const seen: NostrEvent[] = [];

  await new Promise<void>((resolve) => {
    const subscription = pool.request(relays, [filter]).subscribe({
      next(event) {
        seen.push(event);
      },
      error() {
        resolve();
      },
      complete() {
        resolve();
      },
    });

    void subscription;
  });

  if (seen.length === 0) return null;
  const latest = seen.reduce((latest, event) =>
    event.created_at > latest.created_at ? event : latest,
  );

  if (filter["#t"] && !isAuraManifestEvent(latest)) return null;

  await putEvents(seen);
  return latest;
}

async function queryLatestRaw(
  filter: RawNostrFilter,
): Promise<NostrEvent | null> {
  const pool = getPool();
  if (!pool) return null;

  const relayUrls = getPoolRelayUrls();
  const relays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;
  const seen: NostrEvent[] = [];

  await new Promise<void>((resolve) => {
    const subscription = pool.request(relays, [filter]).subscribe({
      next(event) {
        seen.push(event);
      },
      error() {
        resolve();
      },
      complete() {
        resolve();
      },
    });

    void subscription;
  });

  if (seen.length === 0) return null;
  const latest = seen.reduce((latest, event) =>
    event.created_at > latest.created_at ? event : latest,
  );

  await putEvents(seen);
  return latest;
}

export async function fetchManifest(
  pubkey: string,
  options?: { siteName?: string | null; allowLegacy?: boolean },
): Promise<NostrEvent | null> {
  const siteName = options?.siteName?.trim() ?? null;
  const allowLegacy = options?.allowLegacy ?? false;

  if (siteName) {
    const cachedEvents = await getRecentCachedEvents({
      kinds: [15128],
      authors: [pubkey],
      limit: 20,
    });
    const cached = cachedEvents.find((event) => {
      if (!allowLegacy && !isAuraManifestEvent(event)) return false;
      return parseManifestMetadata(event).name === siteName;
    });
    if (cached) return cached;

    const tagged = await queryLatestRaw({
      kinds: [15128],
      authors: [pubkey],
      limit: 1,
      "#name": [siteName],
      "#t": [AURA_MANIFEST_TAG_VALUE],
    });
    if (tagged) return tagged;

    if (!allowLegacy) return null;

    return queryLatestRaw({
      kinds: [15128],
      authors: [pubkey],
      limit: 1,
      "#name": [siteName],
    });
  }

  const tagged = await queryLatest({
    kinds: [15128],
    authors: [pubkey],
    limit: 1,
    "#t": [AURA_MANIFEST_TAG_VALUE],
  });

  if (tagged || !allowLegacy) return tagged;

  const cachedLegacy = await getLatestCachedEvent({
    kinds: [15128],
    authors: [pubkey],
  });
  if (cachedLegacy) return cachedLegacy;

  return queryLatestRaw({
    kinds: [15128],
    authors: [pubkey],
    limit: 1,
  });
}

export async function fetchProfile(pubkey: string): Promise<NostrEvent | null> {
  return queryLatest({ kinds: [0], authors: [pubkey], limit: 1 });
}

export async function fetchEventById(id: string): Promise<NostrEvent | null> {
  const cached = await getCachedEventById(id);
  if (cached) return cached;

  return queryLatestRaw({ ids: [id], limit: 1 });
}

export async function fetchAddressableEvent(options: {
  pubkey: string;
  kind: number;
  identifier: string;
}): Promise<NostrEvent | null> {
  const cachedEvents = await getRecentCachedEvents({
    kinds: [options.kind],
    authors: [options.pubkey],
    limit: 20,
  });
  const cached = cachedEvents.find((event) =>
    event.tags.some((tag) => tag[0] === "d" && tag[1] === options.identifier),
  );
  if (cached) return cached;

  return queryLatestRaw({
    kinds: [options.kind],
    authors: [options.pubkey],
    "#d": [options.identifier],
    limit: 1,
  });
}

export async function fetchBlossomServers(pubkey: string): Promise<string[]> {
  const event = await queryLatest({
    kinds: [10063],
    authors: [pubkey],
    limit: 1,
  });
  if (!event) return [];
  return event.tags
    .filter((tag) => tag[0] === "server" && typeof tag[1] === "string")
    .map((tag) => tag[1]);
}

export async function fetchRelayList(pubkey: string): Promise<string[]> {
  const event = await queryLatest({
    kinds: [10002],
    authors: [pubkey],
    limit: 1,
  });
  if (!event) return [];
  return event.tags
    .filter((tag) => tag[0] === "r" && typeof tag[1] === "string")
    .map((tag) => tag[1]);
}

export async function fetchFollowingList(pubkey: string): Promise<string[]> {
  const event = await queryLatest({
    kinds: [3],
    authors: [pubkey],
    limit: 1,
  });
  if (!event) return [];

  const seen = new Set<string>();
  const following: string[] = [];

  for (const tag of event.tags) {
    if (tag[0] !== "p" || typeof tag[1] !== "string") continue;
    const target = tag[1].trim();
    if (!target || seen.has(target)) continue;
    seen.add(target);
    following.push(target);
  }

  return following;
}
