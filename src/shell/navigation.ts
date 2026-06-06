export function normalizeSitePath(path: string): string {
  if (!path) return "/index.html";
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildAuraSiteUrl(npub: string, path: string): string {
  return `/~${npub}${normalizeSitePath(path)}`;
}

export function buildAuraSiteHash(npub: string, path: string): string {
  return `#${buildAuraSiteUrl(npub, path)}`;
}

export function buildAuraSearchHash(query: string): string {
  return `#search=${encodeURIComponent(query)}`;
}

export type AuraRoute =
  | {
      kind: "home";
    }
  | {
      kind: "site";
      npub: string;
      path: string;
    }
  | {
      kind: "search";
      query: string;
    };

export function readAuraRouteFromHash(hash: string): AuraRoute {
  const raw = hash.replace(/^#/, "");
  if (!raw) return { kind: "home" };

  if (raw.startsWith("search=")) {
    const encoded = raw.slice("search=".length);
    let query = "";
    try {
      query = decodeURIComponent(encoded);
    } catch {
      query = encoded;
    }

    return {
      kind: "search",
      query,
    };
  }

  if (!raw.startsWith("/~")) return { kind: "home" };

  const match = /^\/~([^/]+)(\/.*)?$/.exec(raw);
  if (!match) return { kind: "home" };

  return {
    kind: "site",
    npub: match[1],
    path: match[2] ?? "/index.html",
  };
}

export function readAuraSiteFromHash(
  hash: string,
): { npub: string; path: string } | null {
  const route = readAuraRouteFromHash(hash);
  return route.kind === "site" ? { npub: route.npub, path: route.path } : null;
}
