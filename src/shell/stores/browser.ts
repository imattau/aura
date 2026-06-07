import { normalizeSitePath } from "../navigation";

const RECENT_SITES_KEY = "aura_recent_sites";
const MAX_RECENT_SITES = 8;

export interface RecentSite {
  npub: string;
  siteName?: string | null;
  path: string;
  label: string;
  description?: string | null;
  visitedAt: number;
}

function loadRecentSites(): RecentSite[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(RECENT_SITES_KEY) ?? "[]",
    ) as RecentSite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentSites(sites: RecentSite[]): void {
  localStorage.setItem(RECENT_SITES_KEY, JSON.stringify(sites));
}

export function listRecentSites(): RecentSite[] {
  return loadRecentSites().slice(0, MAX_RECENT_SITES);
}

export function recordRecentSite(
  npub: string,
  path: string,
  label: string,
  description?: string | null,
  siteName?: string | null,
): void {
  const normalizedPath = normalizeSitePath(path);
  const normalizedSiteName = siteName?.trim() || null;
  const nextEntry: RecentSite = {
    npub,
    siteName: normalizedSiteName,
    path: normalizedPath,
    label: label.trim() || npub,
    description: description?.trim() || null,
    visitedAt: Date.now(),
  };

  const nextSites = loadRecentSites().filter(
    (site) =>
      site.npub !== npub ||
      site.path !== normalizedPath ||
      (site.siteName ?? null) !== normalizedSiteName,
  );
  nextSites.unshift(nextEntry);
  saveRecentSites(nextSites.slice(0, MAX_RECENT_SITES));
}

export function clearRecentSites(): void {
  localStorage.removeItem(RECENT_SITES_KEY);
}
