import { RelayPool } from "applesauce-relay";

import { DEFAULT_RELAYS } from "./constants";

let pool: RelayPool | undefined;
let configuredRelayUrls: string[] = [];

export function mergeRelayUrls(...relayGroups: string[][]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const group of relayGroups) {
    for (const relayUrl of group) {
      const normalized = relayUrl.trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);
    }
  }

  return merged;
}

export function createPool(relayUrls: string[]): RelayPool {
  pool = new RelayPool();
  configuredRelayUrls = [...relayUrls];

  for (const relayUrl of relayUrls) {
    pool.relay(relayUrl);
  }

  return pool;
}

export function ensurePool(relayUrls: string[] = DEFAULT_RELAYS): RelayPool {
  return pool ?? createPool(relayUrls);
}

export function getPool(): RelayPool | undefined {
  return pool;
}

export function getPoolRelayUrls(): string[] {
  return [...configuredRelayUrls];
}
