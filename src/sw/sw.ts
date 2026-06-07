import { fetchBlob } from "../blossom/client";
import { DEFAULT_BLOSSOM_SERVERS } from "../blossom/constants";
import { DEMO_SITE_NPUB } from "../demo/constants";
import { DEFAULT_RELAYS } from "../nostr/constants";
import { createPool } from "../nostr/pool";
import { fetchBlossomServers, fetchManifest } from "../nostr/queries";
import { nip19 } from "nostr-tools";
import {
  getCachedManifestEntry,
  getManifestFiles,
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
  event.respondWith(
    (async () => {
      const client =
        event.clientId && "clients" in self
          ? await self.clients.get(event.clientId)
          : null;
      const match = matchAuraPath(event.request.url, client?.url ?? null);
      if (!match) {
        return fetch(event.request);
      }

      return handleAuraRequest(
        {
          npub: match.npub,
          siteName: match.siteName,
          path: match.path,
        },
        (promise) => event.waitUntil(promise),
      );
    })(),
  );
});

export async function handleAuraRequest(
  address: { npub: string; siteName: string | null; path: string },
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const { npub, siteName, path } = address;

  if (npub === DEMO_SITE_NPUB) {
    return serveDemoSiteAsset(path);
  }

  let pubkeyHex: string;
  try {
    const decoded = nip19.decode(npub);
    if (decoded.type !== "npub") throw new Error("not an npub");
    pubkeyHex = decoded.data;
  } catch {
    return createDiagnosticResponse({
      title: "Invalid npub",
      summary: "The address does not contain a valid Nostr public key.",
      hint: "Check the npub in the address bar.",
      npub,
      path,
      status: 400,
      step: "manifest",
    });
  }

  const cachedManifest = await getCachedManifestEntry(npub, siteName);
  let manifestEvent = cachedManifest?.event ?? null;

  if (cachedManifest) {
    if (!isCachedManifestFresh(cachedManifest)) {
      waitUntil?.(refreshManifest(pubkeyHex, npub, siteName));
    }
  } else {
    manifestEvent = await fetchManifest(pubkeyHex, {
      allowLegacy: true,
      ...(siteName ? { siteName } : {}),
    });
    if (!manifestEvent) {
      return createDiagnosticResponse({
        title: "Manifest not found",
        summary:
          "Aura could not find a publishable site manifest for this pubkey.",
        hint: "Make sure the site has a kind:15128 manifest tagged aura-site and published to the relays Aura is using.",
        npub,
        path,
        status: 404,
        step: "manifest",
      });
    }
    await setCachedManifest(npub, manifestEvent, siteName ?? undefined);
  }

  if (!manifestEvent) {
    return createDiagnosticResponse({
      title: "Manifest not found",
      summary: "Aura could not load a usable manifest from cache or relays.",
      hint: "Republish the site manifest and make sure it includes the aura-site tag.",
      npub,
      path,
      status: 404,
      step: "manifest",
    });
  }

  const files = getManifestFiles(manifestEvent);
  const sha256 = files[path];
  if (!sha256) {
    return createDiagnosticResponse({
      title: "Path not found in manifest",
      summary: `The manifest does not map ${path} to a blob hash.`,
      hint: "Add the file to the manifest's files map or change the site's start path.",
      npub,
      path,
      status: 404,
      step: "manifest",
    });
  }

  const ownerServers = await fetchBlossomServers(pubkeyHex);
  const servers =
    ownerServers.length > 0
      ? [...ownerServers, ...DEFAULT_BLOSSOM_SERVERS]
      : DEFAULT_BLOSSOM_SERVERS;

  const blob = await fetchBlob(sha256, servers);
  if (!blob) {
    return createDiagnosticResponse({
      title: "Blob unavailable",
      summary:
        "Aura could not fetch a verified Blossom blob for the requested file.",
      hint: "Check that the blob exists on one of the configured Blossom servers and that the SHA-256 hash matches the manifest.",
      npub,
      path,
      status: 502,
      step: "blossom",
    });
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

async function refreshManifest(
  pubkeyHex: string,
  npub: string,
  siteName?: string | null,
): Promise<void> {
  const manifestEvent = await fetchManifest(pubkeyHex, {
    allowLegacy: true,
    ...(siteName ? { siteName } : {}),
  });
  if (!manifestEvent) return;
  await setCachedManifest(npub, manifestEvent, siteName ?? undefined);
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

function createDiagnosticResponse(options: {
  title: string;
  summary: string;
  hint: string;
  npub: string;
  path: string;
  status: number;
  step: string;
}): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Aura diagnostics - ${escapeHtml(options.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d0905;
        --panel: #17110b;
        --panel-2: #22180f;
        --line: rgba(255, 180, 80, 0.16);
        --text: #f5ede0;
        --muted: #ae9a82;
        --accent: #f97316;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body {
        background:
          radial-gradient(circle at 20% 0%, rgba(249, 115, 22, 0.18), transparent 30%),
          linear-gradient(180deg, #110c07 0%, var(--bg) 100%);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, sans-serif;
        padding: 2rem;
      }
      .overlay {
        max-width: 58rem;
        margin: 0 auto;
        padding: 1.5rem;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), var(--panel);
        box-shadow: 0 24px 72px rgba(0, 0, 0, 0.5);
      }
      .eyebrow {
        display: inline-flex;
        padding: 0.35rem 0.65rem;
        border-radius: 999px;
        border: 1px solid var(--line);
        color: var(--accent);
        font-size: 0.72rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0.85rem 0 0.35rem;
        font-size: clamp(1.6rem, 4vw, 2.5rem);
        line-height: 1.1;
      }
      p {
        margin: 0.4rem 0 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .grid {
        display: grid;
        gap: 0.85rem;
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
        margin-top: 1.25rem;
      }
      .card {
        padding: 1rem;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: var(--panel-2);
      }
      .label {
        display: block;
        margin-bottom: 0.35rem;
        color: var(--accent);
        font-size: 0.72rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      code {
        display: block;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--text);
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-size: 0.92rem;
      }
    </style>
  </head>
  <body>
    <main class="overlay">
      <span class="eyebrow">Aura diagnostic</span>
      <h1>${escapeHtml(options.title)}</h1>
      <p>${escapeHtml(options.summary)}</p>
      <div class="grid">
        <section class="card">
          <span class="label">What to check</span>
          <p>${escapeHtml(options.hint)}</p>
        </section>
        <section class="card">
          <span class="label">Request</span>
          <code>npub: ${escapeHtml(options.npub)}\npath: ${escapeHtml(
            options.path,
          )}\nstep: ${escapeHtml(options.step)}\nstatus: ${options.status}</code>
        </section>
      </div>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status: options.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
