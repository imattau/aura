import type { NostrEvent } from "nostr-tools";
import { DEFAULT_RELAYS } from "./constants";
import { putEvents } from "./event-store";
import { createPool, getPool, getPoolRelayUrls } from "./pool";

type SubscriptionLike = { unsubscribe?: () => void } | null;

const INGRESS_FILTER = {
  kinds: [0, 1, 3, 10002, 10063, 15128, 30023],
  limit: 500,
};

let activeSignature: string | null = null;
let activeSubscription: SubscriptionLike = null;

function normalizeRelayUrls(relayUrls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const relayUrl of relayUrls) {
    const normalized = relayUrl.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function stopEventSync(): void {
  activeSubscription?.unsubscribe?.();
  activeSubscription = null;
  activeSignature = null;
}

export function startEventSync(relayUrls: string[] = DEFAULT_RELAYS): void {
  if (typeof window === "undefined") return;

  const pool = getPool() ?? createPool(DEFAULT_RELAYS);
  const normalizedRelays = normalizeRelayUrls(
    relayUrls.length > 0 ? relayUrls : getPoolRelayUrls(),
  );
  const effectiveRelays =
    normalizedRelays.length > 0 ? normalizedRelays : DEFAULT_RELAYS;
  const signature = effectiveRelays.join("|");

  if (activeSignature === signature && activeSubscription) return;
  stopEventSync();
  activeSignature = signature;

  activeSubscription = pool
    .request(effectiveRelays, [INGRESS_FILTER])
    .subscribe({
      next(event: NostrEvent) {
        void putEvents([event]);
      },
      error() {
        stopEventSync();
      },
      complete() {
        stopEventSync();
      },
    });
}
