import { type NostrEvent, nip19 } from "nostr-tools";
import { isAuraManifestEvent, parseManifestMetadata } from "../sw/manifest";
import { DEFAULT_RELAYS } from "./constants";
import { putEvents, searchCachedDocuments } from "./event-store";
import { createPool, getPool, getPoolRelayUrls } from "./pool";

type SearchFilter = {
  kinds: number[];
  limit: number;
  search?: string;
};

export type SearchHitKind = "site" | "article" | "note" | "user" | "other";

export interface SearchHit {
  id: string;
  kind: number;
  kindLabel: string;
  title: string;
  summary: string;
  pubkey: string;
  npub: string;
  createdAt: number;
  resultKind: SearchHitKind;
  path?: string;
}

function getHitDedupeKey(hit: SearchHit): string {
  if (hit.resultKind === "site" || hit.resultKind === "user") {
    return `${hit.resultKind}:${hit.pubkey}`;
  }

  return `${hit.resultKind}:${hit.id}`;
}

function shorten(value: string, length: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= length) return compact;
  return `${compact.slice(0, length - 1).trimEnd()}…`;
}

function firstLine(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function summarizeContent(value: string, length: number): string {
  return shorten(value, length);
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(
  value: string | null | undefined,
  query: string,
): boolean {
  if (!value) return false;
  return normalizeQuery(value).includes(query);
}

function eventMatchesQuery(event: NostrEvent, query: string): boolean {
  const normalized = normalizeQuery(query);
  if (!normalized) return false;

  if (matchesQuery(event.content, normalized)) return true;

  if (event.kind === 15128) {
    if (!isAuraManifestEvent(event)) return false;
    const manifest = parseManifestMetadata(event);
    const manifestFields = [
      manifest.name,
      manifest.description,
      manifest.icon,
      manifest.version,
      manifest.startPath,
      manifest.themeColor,
      JSON.stringify(manifest.files),
    ];
    return manifestFields.some((field) => matchesQuery(field, normalized));
  }

  if (event.kind === 0) {
    try {
      const parsed = JSON.parse(event.content) as {
        name?: unknown;
        about?: unknown;
        picture?: unknown;
        website?: unknown;
        lud16?: unknown;
        nip05?: unknown;
      };
      const profileFields = [
        parsed.name,
        parsed.about,
        parsed.picture,
        parsed.website,
        parsed.lud16,
        parsed.nip05,
      ];
      return profileFields.some((field) => matchesQuery(field, normalized));
    } catch {
      // fall through to tags
    }
  }

  return event.tags.some((tag) =>
    tag.some((value) => matchesQuery(value, normalized)),
  );
}

async function queryEvents(
  filters: SearchFilter[],
  maxWaitMs = 2500,
): Promise<NostrEvent[]> {
  const pool = getPool() ?? createPool(DEFAULT_RELAYS);

  const relayUrls = getPoolRelayUrls();
  const relays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;
  const seen = new Map<string, NostrEvent>();

  return new Promise((resolve) => {
    let settled = false;
    let subscription: { unsubscribe?: () => void } | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.unsubscribe?.();
      void putEvents([...seen.values()]).finally(() => {
        resolve([...seen.values()]);
      });
    };

    const timeout = setTimeout(finish, maxWaitMs);
    subscription = pool.request(relays, filters).subscribe({
      next(event) {
        if (!seen.has(event.id)) {
          seen.set(event.id, event);
        }
      },
      error() {
        finish();
      },
      complete() {
        finish();
      },
    });
  });
}

async function queryCachedMatches(query: string): Promise<SearchHit[]> {
  const docs = await searchCachedDocuments(query, 64);
  return docs.map((document) => toHitFromCachedDocument(document));
}

async function queryRecentRelayMatches(query: string): Promise<NostrEvent[]> {
  const recentEvents = await queryEvents([
    { kinds: [15128], limit: 24, "#t": ["aura-site"] },
    { kinds: [30023], limit: 24 },
    { kinds: [1], limit: 48 },
    { kinds: [0], limit: 24 },
  ]);

  return recentEvents.filter((event) => eventMatchesQuery(event, query));
}

function toHit(event: NostrEvent): SearchHit {
  const npub = nip19.npubEncode(event.pubkey);

  if (event.kind === 15128) {
    if (!isAuraManifestEvent(event)) {
      return {
        id: event.id,
        kind: event.kind,
        kindLabel: "Kind 15128",
        title: npub,
        summary: "Unrecognized manifest",
        pubkey: event.pubkey,
        npub,
        createdAt: event.created_at,
        resultKind: "other",
      };
    }
    const manifest = parseManifestMetadata(event);
    const title =
      manifest.name ??
      manifest.description ??
      shorten(firstLine(event.content), 64) ??
      npub;
    const summary =
      manifest.description ??
      summarizeContent(event.content, 180) ??
      "Aura site";

    return {
      id: event.id,
      kind: event.kind,
      kindLabel: "Aura site",
      title,
      summary,
      pubkey: event.pubkey,
      npub,
      createdAt: event.created_at,
      resultKind: "site",
      path: manifest.startPath,
    };
  }

  if (event.kind === 30023) {
    const title = firstLine(event.content) || "Long-form article";
    const summary = summarizeContent(event.content, 220) || "Article";

    return {
      id: event.id,
      kind: event.kind,
      kindLabel: "Article",
      title,
      summary,
      pubkey: event.pubkey,
      npub,
      createdAt: event.created_at,
      resultKind: "article",
    };
  }

  if (event.kind === 0) {
    try {
      const parsed = JSON.parse(event.content) as {
        name?: unknown;
        about?: unknown;
        picture?: unknown;
        website?: unknown;
        lud16?: unknown;
        nip05?: unknown;
      };
      const title =
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name
          : npub;
      const summary =
        [parsed.about, parsed.website, parsed.nip05, parsed.lud16]
          .map((field) => (typeof field === "string" ? field.trim() : ""))
          .find(Boolean) ?? "Profile";

      return {
        id: event.id,
        kind: event.kind,
        kindLabel: "User",
        title,
        summary,
        pubkey: event.pubkey,
        npub,
        createdAt: event.created_at,
        resultKind: "user",
      };
    } catch {
      return {
        id: event.id,
        kind: event.kind,
        kindLabel: "User",
        title: npub,
        summary: "Profile",
        pubkey: event.pubkey,
        npub,
        createdAt: event.created_at,
        resultKind: "user",
      };
    }
  }

  if (event.kind === 1) {
    const title = firstLine(event.content) || "Note";
    const summary = summarizeContent(event.content, 200) || "Note";

    return {
      id: event.id,
      kind: event.kind,
      kindLabel: "Note",
      title,
      summary,
      pubkey: event.pubkey,
      npub,
      createdAt: event.created_at,
      resultKind: "note",
    };
  }

  const title = firstLine(event.content) || `Kind ${event.kind}`;
  const summary = summarizeContent(event.content, 180) || "Nostr content";

  return {
    id: event.id,
    kind: event.kind,
    kindLabel: `Kind ${event.kind}`,
    title,
    summary,
    pubkey: event.pubkey,
    npub,
    createdAt: event.created_at,
    resultKind: "other",
  };
}

function dedupeSearchHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();

  return hits.filter((hit) => {
    const key = getHitDedupeKey(hit);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toHitFromCachedDocument(document: {
  id: string;
  kind: number;
  kindLabel: string;
  title: string;
  summary: string;
  pubkey: string;
  createdAt: number;
  resultKind: SearchHitKind;
  path?: string;
}): SearchHit {
  return {
    id: document.id,
    kind: document.kind,
    kindLabel: document.kindLabel,
    title: document.title,
    summary: document.summary,
    pubkey: document.pubkey,
    npub: nip19.npubEncode(document.pubkey),
    createdAt: document.createdAt,
    resultKind: document.resultKind,
    path: document.path,
  };
}

export async function searchNostrContent(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cached = await queryCachedMatches(trimmed);
  const searched = await queryEvents([
    { kinds: [15128], limit: 12, search: trimmed, "#t": ["aura-site"] },
    { kinds: [30023], limit: 12, search: trimmed },
    { kinds: [1], limit: 12, search: trimmed },
    { kinds: [0], limit: 12, search: trimmed },
  ]);

  const fallback =
    cached.length > 0 || searched.length > 0
      ? []
      : await queryRecentRelayMatches(trimmed);

  return dedupeSearchHits([
    ...cached,
    ...searched.map(toHit),
    ...fallback.map(toHit),
  ]);
}
