export interface AuraMatch {
  npub: string;
  siteName: string | null;
  path: string;
}

const AURA_RE = /^\/~([^/]+)(\/.*)?$/;

function normalizeAuraPath(pathname: string): {
  siteName: string | null;
  path: string;
} | null {
  const match = AURA_RE.exec(pathname);
  if (!match) return null;

  const rawPath = match[2] ?? "/";
  const normalizedPath = rawPath === "/" ? "/index.html" : rawPath;
  const parts = normalizedPath.split("/").filter(Boolean);

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
      siteName,
      path: path === "/" ? "/index.html" : path.replace(/^\/+/, "/"),
    };
  }

  return {
    siteName: null,
    path: normalizedPath.replace(/^\/+/, "/"),
  };
}

export function matchAuraPath(
  urlString: string,
  clientUrl?: string | null,
): AuraMatch | null {
  const url = new URL(urlString);
  const directPath = normalizeAuraPath(url.pathname);
  if (directPath) {
    return {
      npub: AURA_RE.exec(url.pathname)?.[1] ?? "",
      siteName: directPath.siteName,
      path: directPath.path,
    };
  }

  if (!clientUrl) return null;

  const client = new URL(clientUrl);
  if (client.origin !== url.origin) return null;

  const clientMatch = AURA_RE.exec(client.pathname);
  if (!clientMatch) return null;

  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  return {
    npub: clientMatch[1],
    siteName: normalizeAuraPath(client.pathname)?.siteName ?? null,
    path,
  };
}
