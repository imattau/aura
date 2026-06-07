import type { NostrEvent } from "nostr-tools";

const CACHE_NAME = "aura-manifests-v1";
const TTL_MS = 5 * 60 * 1000;
export const AURA_MANIFEST_TAG_KEY = "t";
export const AURA_MANIFEST_TAG_VALUE = "aura-site";

export interface CachedManifest {
  event: NostrEvent;
  cachedAt: number;
}

export interface ManifestMetadata {
  name: string | null;
  description: string | null;
  icon: string | null;
  version: string | null;
  startPath: string;
  themeColor: string | null;
  files: Record<string, string>;
}

export function isAuraManifestEvent(event: NostrEvent): boolean {
  return event.tags.some(
    (tag) =>
      tag[0] === AURA_MANIFEST_TAG_KEY && tag[1] === AURA_MANIFEST_TAG_VALUE,
  );
}

function cacheKey(pubkey: string, siteName?: string | null): string {
  const normalizedSiteName = siteName?.trim() ?? "";
  return `manifest:${pubkey}:${normalizedSiteName}`;
}

export async function getCachedManifestEntry(
  pubkey: string,
  siteName?: string | null,
): Promise<CachedManifest | null> {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(cacheKey(pubkey, siteName));
  if (!response) return null;

  try {
    return (await response.json()) as CachedManifest;
  } catch {
    return null;
  }
}

export function isCachedManifestFresh(
  entry: CachedManifest,
  now = Date.now(),
): boolean {
  return now - entry.cachedAt <= TTL_MS;
}

export async function getCachedManifest(
  pubkey: string,
  siteName?: string | null,
): Promise<NostrEvent | null> {
  const entry = await getCachedManifestEntry(pubkey, siteName);
  if (!entry || !isCachedManifestFresh(entry)) return null;
  return entry.event;
}

export async function setCachedManifest(
  pubkey: string,
  event: NostrEvent,
  siteName?: string | null,
): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  const entry: CachedManifest = {
    event,
    cachedAt: Date.now(),
  };

  await cache.put(
    cacheKey(pubkey, siteName),
    new Response(JSON.stringify(entry)),
  );
}

export function getManifestFiles(event: NostrEvent): Record<string, string> {
  return parseManifestMetadata(event).files;
}

export function getManifestName(event: NostrEvent): string | null {
  return parseManifestMetadata(event).name;
}

function readStringField(
  value: unknown,
  fallback: string | null = null,
): string | null {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function parseManifestMetadata(event: NostrEvent): ManifestMetadata {
  try {
    const parsed = JSON.parse(event.content) as {
      files?: Record<string, string>;
      description?: unknown;
      icon?: unknown;
      version?: unknown;
      start_path?: unknown;
      theme_color?: unknown;
      name?: unknown;
    };

    const nameTag = event.tags.find((candidate) => candidate[0] === "name");
    const descriptionTag = event.tags.find(
      (candidate) => candidate[0] === "description",
    );
    const iconTag = event.tags.find((candidate) => candidate[0] === "icon");
    const versionTag = event.tags.find(
      (candidate) => candidate[0] === "version",
    );
    const startPathTag = event.tags.find(
      (candidate) => candidate[0] === "start_path",
    );
    const themeColorTag = event.tags.find(
      (candidate) => candidate[0] === "theme_color",
    );

    return {
      name: readStringField(nameTag?.[1], readStringField(parsed.name)),
      description: readStringField(
        descriptionTag?.[1],
        readStringField(parsed.description),
      ),
      icon: readStringField(iconTag?.[1], readStringField(parsed.icon)),
      version: readStringField(
        versionTag?.[1],
        readStringField(parsed.version),
      ),
      startPath:
        readStringField(
          startPathTag?.[1],
          readStringField(parsed.start_path, "/index.html"),
        ) ?? "/index.html",
      themeColor: readStringField(
        themeColorTag?.[1],
        readStringField(parsed.theme_color),
      ),
      files: parsed.files ?? {},
    };
  } catch {
    return {
      name: null,
      description: null,
      icon: null,
      version: null,
      startPath: "/index.html",
      themeColor: null,
      files: {},
    };
  }
}
