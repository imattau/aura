import { fetchBlob } from "../blossom/client";
import { DEFAULT_BLOSSOM_SERVERS } from "../blossom/constants";
import { DEMO_SITE_NPUB } from "../demo/constants";
import { DEFAULT_RELAYS } from "../nostr/constants";
import { createPool } from "../nostr/pool";
import { fetchBlossomServers, fetchManifest } from "../nostr/queries";
import {
  getCachedManifestEntry,
  getManifestFiles,
  isAuraManifestEvent,
  isCachedManifestFresh,
  setCachedManifest,
} from "./manifest";
import { extToMime } from "./mime";
import { matchAuraPath } from "./router";

declare const self: ServiceWorkerGlobalScope;

createPool(DEFAULT_RELAYS);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string; relays?: string[] } | undefined;
  if (data?.type !== "aura:set-relays" || !Array.isArray(data.relays)) return;
  createPool(data.relays);
});

self.addEventListener("fetch", (event: FetchEvent) => {
  const match = matchAuraPath(event.request.url);
  if (!match) return;
  event.respondWith(
    handleAuraRequest(match.npub, match.path, (promise) =>
      event.waitUntil(promise),
    ),
  );
});

export async function handleAuraRequest(
  npub: string,
  path: string,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  if (npub === DEMO_SITE_NPUB) {
    return serveDemoSiteAsset(path);
  }

  const cachedManifest = await getCachedManifestEntry(npub);
  let manifestEvent = cachedManifest?.event ?? null;

  if (cachedManifest) {
    if (!isAuraManifestEvent(cachedManifest.event)) {
      manifestEvent = null;
    } else if (!isCachedManifestFresh(cachedManifest)) {
      waitUntil?.(refreshManifest(npub));
    }
  } else {
    manifestEvent = await fetchManifest(npub);
    if (!manifestEvent) {
      return new Response("Manifest not found", { status: 404 });
    }
    await setCachedManifest(npub, manifestEvent);
  }

  if (!manifestEvent) {
    return new Response("Manifest not found", { status: 404 });
  }

  const files = getManifestFiles(manifestEvent);
  const sha256 = files[path];
  if (!sha256) {
    return new Response("File not found in manifest", { status: 404 });
  }

  const ownerServers = await fetchBlossomServers(npub);
  const servers =
    ownerServers.length > 0
      ? [...ownerServers, ...DEFAULT_BLOSSOM_SERVERS]
      : DEFAULT_BLOSSOM_SERVERS;

  const blob = await fetchBlob(sha256, servers);
  if (!blob) {
    return new Response("Blob not found or hash mismatch", { status: 403 });
  }

  const body =
    typeof blob.arrayBuffer === "function"
      ? await blob.arrayBuffer()
      : typeof blob.text === "function"
        ? await blob.text()
        : blob;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": extToMime(path),
    },
  });
}

async function refreshManifest(pubkey: string): Promise<void> {
  const manifestEvent = await fetchManifest(pubkey);
  if (!manifestEvent || !isAuraManifestEvent(manifestEvent)) return;
  await setCachedManifest(pubkey, manifestEvent);
}

async function serveDemoSiteAsset(path: string): Promise<Response> {
  const normalizedPath =
    path === "/" ? "/index.html" : path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`/demo-site${normalizedPath}`, self.location.origin);
  const response = await fetch(url);

  if (!response.ok) {
    return new Response("Demo site asset not found", { status: 404 });
  }

  const contentType = extToMime(normalizedPath);
  const bodyBlob = await response.blob();
  const body =
    typeof bodyBlob.arrayBuffer === "function"
      ? await bodyBlob.arrayBuffer()
      : typeof bodyBlob.text === "function"
        ? await bodyBlob.text()
        : bodyBlob;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
    },
  });
}
