export interface AuraMatch {
  npub: string;
  path: string;
}

const AURA_RE = /^\/~([^/]+)(\/.*)?$/;

export function matchAuraPath(urlString: string): AuraMatch | null {
  const url = new URL(urlString);
  const match = AURA_RE.exec(url.pathname);
  if (!match) return null;

  const npub = match[1];
  const path = match[2] ?? "/";
  return {
    npub,
    path: path === "/" ? "/index.html" : path,
  };
}
