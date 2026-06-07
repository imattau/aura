export interface AuraAddress {
  npub: string;
  siteName: string | null;
  path: string;
}

export function parseAuraAddress(value: string): AuraAddress | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("~") && !trimmed.startsWith("/~")) return null;

  const raw = trimmed.replace(/^\/?~/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  const target = parts[0];
  if (!target.startsWith("npub1")) return null;

  if (parts.length >= 3) {
    let siteName = parts[1];
    try {
      siteName = decodeURIComponent(siteName);
    } catch {
      siteName = parts[1];
    }
    return {
      npub: target,
      siteName,
      path: `/${parts.slice(2).join("/")}`,
    };
  }

  if (parts.length === 2) {
    return {
      npub: target,
      siteName: null,
      path: `/${parts[1]}`,
    };
  }

  return {
    npub: target,
    siteName: null,
    path: "/index.html",
  };
}
