export function normalizeSitePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/index.html";

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.replace(/^\/+/, "/");
}

export function buildAuraSiteUrl(
  npub: string,
  path: string,
  siteName?: string | null,
): string {
  const normalizedPath = normalizeSitePath(path);
  const sitePrefix = siteName?.trim()
    ? `/${encodeURIComponent(siteName.trim())}`
    : "";
  return `/~${npub}${sitePrefix}${normalizedPath}`;
}

export function buildAuraSiteHash(
  npub: string,
  path: string,
  siteName?: string | null,
): string {
  return `#${buildAuraSiteUrl(npub, path, siteName)}`;
}

export function buildAuraSearchHash(query: string): string {
  return `#search=${encodeURIComponent(query)}`;
}

export function buildAuraNostrHash(uri: string): string {
  return `#nostr=${encodeURIComponent(uri)}`;
}

export function buildAuraSettingsHash(): string {
  return "#settings";
}

export type AuraRoute =
  | {
      kind: "home";
    }
  | {
      kind: "settings";
    }
  | {
      kind: "site";
      npub: string;
      siteName: string | null;
      path: string;
    }
  | {
      kind: "search";
      query: string;
    }
  | {
      kind: "nostr";
      uri: string;
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

  if (raw.startsWith("nostr=")) {
    const encoded = raw.slice("nostr=".length);
    let uri = "";
    try {
      uri = decodeURIComponent(encoded);
    } catch {
      uri = encoded;
    }

    return {
      kind: "nostr",
      uri,
    };
  }

  if (raw === "settings") {
    return {
      kind: "settings",
    };
  }

  if (!raw.startsWith("/~")) return { kind: "home" };

  const match = /^\/~([^/]+)(\/.*)?$/.exec(raw);
  if (!match) return { kind: "home" };

  const remainder = match[2] ?? "/";
  const normalizedRemainder = remainder === "/" ? "/index.html" : remainder;
  const parts = normalizedRemainder.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const [rawSiteName, ...pathParts] = parts;
    let siteName = rawSiteName;
    try {
      siteName = decodeURIComponent(rawSiteName);
    } catch {
      siteName = rawSiteName;
    }
    const path = `/${pathParts.join("/")}` || "/index.html";
    return {
      kind: "site",
      npub: match[1],
      siteName,
      path: path === "/" ? "/index.html" : path,
    };
  }

  return {
    kind: "site",
    npub: match[1],
    siteName: null,
    path: normalizedRemainder === "/" ? "/index.html" : normalizedRemainder,
  };
}

export function readAuraSiteFromHash(
  hash: string,
): { npub: string; siteName: string | null; path: string } | null {
  const route = readAuraRouteFromHash(hash);
  return route.kind === "site"
    ? { npub: route.npub, siteName: route.siteName, path: route.path }
    : null;
}
