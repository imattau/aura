import type { NostrEvent } from "nostr-tools";
import {
  AURA_MANIFEST_TAG_KEY,
  AURA_MANIFEST_TAG_VALUE,
  isAuraManifestEvent,
} from "../sw/manifest";
import { DEFAULT_RELAYS } from "./constants";
import { getLatestCachedEvent, putEvents } from "./event-store";
import { getPool, getPoolRelayUrls } from "./pool";

type SimpleFilter = {
  kinds: number[];
  authors: string[];
  limit: number;
  "#t"?: string[];
};

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

export async function fetchManifest(
  pubkey: string,
): Promise<NostrEvent | null> {
  return queryLatest({
    kinds: [15128],
    authors: [pubkey],
    limit: 1,
    "#t": [AURA_MANIFEST_TAG_VALUE],
  });
}

export async function fetchProfile(pubkey: string): Promise<NostrEvent | null> {
  return queryLatest({ kinds: [0], authors: [pubkey], limit: 1 });
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
