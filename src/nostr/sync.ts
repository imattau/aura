import type { NostrEvent } from "nostr-tools";
import { DEFAULT_RELAYS } from "./constants";
import { putEvents } from "./event-store";
import { createPool, getPool, getPoolRelayUrls } from "./pool";
import type { RelaySubscriptionMode } from "../shell/stores/settings";

type SubscriptionLike = { unsubscribe?: () => void } | null;

const INGRESS_FILTER = {
  kinds: [0, 1, 3, 10002, 10063, 15128, 30023],
  limit: 500,
};

const FOLLOWING_INGRESS_KINDS = [0, 1, 3, 10002, 10063, 15128, 30023];

let activeSignature: string | null = null;
let activeSubscription: SubscriptionLike = null;

function normalizeRelayUrls(relayUrls: string[]): string[] {
  return normalizeTrimmedValues(relayUrls);
}

function normalizeTrimmedValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function buildIngressFilters(options?: {
  pubkey?: string | null;
  following?: string[];
  mode?: RelaySubscriptionMode;
}): Record<string, unknown>[] {
  const mode = options?.mode ?? "global";
  const pubkey = options?.pubkey?.trim() || null;
  const following = normalizeTrimmedValues(options?.following ?? []);

  if (mode === "following" || mode === "global-following") {
    const authors = Array.from(
      new Set(
        [pubkey, ...following].filter((value): value is string => Boolean(value)),
      ),
    );

    if (authors.length > 0) {
      const followingFilter = {
        kinds: FOLLOWING_INGRESS_KINDS,
        authors,
        limit: 500,
      };

      if (mode === "following") {
        return [followingFilter];
      }

      return [INGRESS_FILTER, followingFilter];
    }
  }

  return [INGRESS_FILTER];
}

export function stopEventSync(): void {
  activeSubscription?.unsubscribe?.();
  activeSubscription = null;
  activeSignature = null;
}

export function startEventSync(
  relayUrls: string[] = DEFAULT_RELAYS,
  options?: {
    pubkey?: string | null;
    following?: string[];
    mode?: RelaySubscriptionMode;
  },
): void {
  if (typeof window === "undefined") return;

  const pool = getPool() ?? createPool(DEFAULT_RELAYS);
  const normalizedRelays = normalizeRelayUrls(
    relayUrls.length > 0 ? relayUrls : getPoolRelayUrls(),
  );
  const effectiveRelays =
    normalizedRelays.length > 0 ? normalizedRelays : DEFAULT_RELAYS;
  const mode = options?.mode ?? "global";
  const pubkey = options?.pubkey?.trim() || "";
  const following = normalizeRelayUrls(options?.following ?? []);
  const signature = [
    effectiveRelays.join("|"),
    mode,
    pubkey,
    following.join("|"),
  ].join("::");

  if (activeSignature === signature && activeSubscription) return;
  stopEventSync();
  activeSignature = signature;

  activeSubscription = pool
    .request(effectiveRelays, buildIngressFilters(options))
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
