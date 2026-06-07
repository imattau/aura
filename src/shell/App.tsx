import type * as preact from "preact";
import { useEffect, useState } from "preact/hooks";
import { DEMO_SITE_NPUB } from "../demo/constants";
import { getPool, getPoolRelayUrls } from "../nostr/pool";
import { fetchManifest, fetchProfile } from "../nostr/queries";
import { parseManifestMetadata } from "../sw/manifest";
import { AddressBar } from "./components/AddressBar";
import { AuthPanel } from "./components/AuthPanel";
import { Avatar } from "./components/Avatar";
import { Icon } from "./components/Icon";
import { NostrObjectPage } from "./components/NostrObjectPage";
import { SettingsPage } from "./components/SettingsPage";
import { SearchPage } from "./components/SearchPage";
import { SiteFrame } from "./components/SiteFrame";
import {
  buildAuraNostrHash,
  buildAuraSearchHash,
  buildAuraSettingsHash,
  buildAuraSiteHash,
  readAuraRouteFromHash,
} from "./navigation";
import { type BeforeInstallPromptEvent, isStandaloneMode } from "./pwa";
import {
  loadPersistedPubkey,
  primeRelayPool,
  publishMuteListEntry,
} from "./stores/auth";
import {
  type RecentSite,
  listRecentSites,
  recordRecentSite,
} from "./stores/browser";
import { registerPetname } from "./stores/petnames";

function syncServiceWorkerRelays(): void {
  const relays = getPoolRelayUrls();
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller)
    return;
  navigator.serviceWorker.controller.postMessage({
    type: "aura:set-relays",
    relays,
  });
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.PROD) {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
    return;
  }

  navigator.serviceWorker
    .register("/src/sw/sw.ts", {
      scope: "/",
      type: "module",
    })
    .catch(console.error);
}

function resolveSiteLabel(
  npub: string,
  path: string,
  siteName: string | null,
  preferredLabel: string | null | undefined,
  sites: RecentSite[],
): string {
  if (preferredLabel) return preferredLabel;
  const recent = sites.find(
    (site) =>
      site.npub === npub &&
      site.path === path &&
      (site.siteName ?? null) === (siteName ?? null),
  );
  return recent?.label ?? siteName ?? npub;
}

export function App() {
  const [pubkey, setPubkey] = useState<string | null>(() =>
    loadPersistedPubkey(),
  );
  const initialRoute = readAuraRouteFromHash(window.location.hash);
  const [activeSite, setActiveSite] = useState<{
    npub: string;
    siteName: string | null;
    path: string;
  } | null>(() => (initialRoute.kind === "site" ? initialRoute : null));
  const [currentNpub, setCurrentNpub] = useState<string | null>(
    activeSite?.npub ?? null,
  );
  const [currentSiteName, setCurrentSiteName] = useState<string | null>(
    activeSite?.siteName ?? null,
  );
  const [currentPath, setCurrentPath] = useState<string>(
    activeSite?.path ?? "/index.html",
  );
  const [showSettings, setShowSettings] = useState(
    () => initialRoute.kind === "settings",
  );
  const [currentPetname, setCurrentPetname] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string | null>(() =>
    initialRoute.kind === "search" ? initialRoute.query : null,
  );
  const [nativeNostrUri, setNativeNostrUri] = useState<string | null>(() =>
    initialRoute.kind === "nostr" ? initialRoute.uri : null,
  );
  const [searchNonce, setSearchNonce] = useState(0);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [themeColor, setThemeColor] = useState<string | null>(null);
  const [nativeTitle, setNativeTitle] = useState<string>("Nostr");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());
  const [recentSites, setRecentSites] = useState<RecentSite[]>(() =>
    listRecentSites(),
  );
  const displayedRecentSites =
    recentSites.length > 0
      ? recentSites
      : [
          {
            npub: DEMO_SITE_NPUB,
            path: "/index.html",
            label: "Signal Garden",
            visitedAt: Date.now(),
          },
        ];
  const activeSiteLabel =
    showSettings
      ? "Settings"
      : currentPetname ??
        currentNpub ??
        (nativeNostrUri ? nativeTitle : null) ??
        (searchQuery ? "Search" : "Aura");
  const currentSitePathLabel =
    currentSiteName && currentSiteName.trim()
      ? `${currentSiteName.trim()}${currentPath}`
      : currentPath;
  const canGoHome = Boolean(
    activeSite || searchQuery || nativeNostrUri || showSettings,
  );

  useEffect(() => {
    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });
    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  useEffect(() => {
    if (pubkey) {
      syncServiceWorkerRelays();
    }
  }, [pubkey]);

  useEffect(() => {
    if (!pubkey || getPool()) return;
    void primeRelayPool(pubkey);
  }, [pubkey]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfilePicture() {
      if (!pubkey) {
        setProfilePicture(null);
        return;
      }

      const event = await fetchProfile(pubkey);
      if (cancelled) return;

      if (!event) {
        setProfilePicture(null);
        return;
      }

      try {
        const parsed = JSON.parse(event.content) as { picture?: unknown };
        setProfilePicture(
          typeof parsed.picture === "string" && parsed.picture.trim()
            ? parsed.picture
            : null,
        );
      } catch {
        setProfilePicture(null);
      }
    }

    void loadProfilePicture();

    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const route = readAuraRouteFromHash(window.location.hash);
      if (route.kind === "site") {
        setShowSettings(false);
        setActiveSite(route);
        setCurrentNpub(route.npub);
        setCurrentSiteName(route.siteName);
        setCurrentPath(route.path);
        setSearchQuery(null);
        setNativeNostrUri(null);
        setNativeTitle("Nostr");
        setCurrentPetname(
          resolveSiteLabel(route.npub, route.path, route.siteName, null, recentSites),
        );
        return;
      }

      if (route.kind === "search") {
        setShowSettings(false);
        setActiveSite(null);
        setCurrentNpub(null);
        setCurrentSiteName(null);
        setCurrentPath(route.query || "Search");
        setCurrentPetname(null);
        setSearchQuery(route.query);
        setNativeNostrUri(null);
        setNativeTitle("Nostr");
        return;
      }

      if (route.kind === "nostr") {
        setShowSettings(false);
        setActiveSite(null);
        setCurrentNpub(null);
        setCurrentSiteName(null);
        setCurrentPath("Nostr");
        setCurrentPetname(null);
        setSearchQuery(null);
        setNativeNostrUri(route.uri);
        setNativeTitle("Nostr");
        return;
      }

      if (route.kind === "settings") {
        setActiveSite(null);
        setCurrentNpub(null);
        setCurrentSiteName(null);
        setCurrentPath("Settings");
        setCurrentPetname(null);
        setSearchQuery(null);
        setNativeNostrUri(null);
        setNativeTitle("Nostr");
        setShowSettings(true);
        return;
      }

      setShowSettings(false);
      setActiveSite(null);
      setCurrentNpub(null);
      setCurrentSiteName(null);
      setCurrentPath("/index.html");
      setCurrentPetname(null);
      setSearchQuery(null);
      setNativeNostrUri(null);
      setNativeTitle("Nostr");
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [recentSites]);

  async function handleNavigate(
    npub: string,
    path: string,
    siteName?: string | null,
  ) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    let canonicalSiteName = siteName?.trim() || null;

    try {
      const event = await fetchManifest(npub, {
        siteName: siteName ?? undefined,
        allowLegacy: true,
      });
      const manifest = event ? parseManifestMetadata(event) : null;
      canonicalSiteName = siteName?.trim() || manifest?.name?.trim() || null;
      if (canonicalSiteName) {
        registerPetname(canonicalSiteName, npub);
      }
      const targetPath =
        normalizedPath === "/"
          ? (manifest?.startPath ?? "/index.html")
          : normalizedPath;
      const label = resolveSiteLabel(
        npub,
        targetPath,
        canonicalSiteName,
        canonicalSiteName,
        recentSites,
      );
      setCurrentPetname(label);
      recordRecentSite(
        npub,
        targetPath,
        label,
        manifest?.description ?? null,
        canonicalSiteName,
      );
      setRecentSites(listRecentSites());
    } finally {
      const targetPath =
        normalizedPath === "/" ? "/index.html" : normalizedPath;
      setActiveSite({ npub, siteName: canonicalSiteName, path: targetPath });
      setCurrentNpub(npub);
      setCurrentSiteName(canonicalSiteName);
      setCurrentPath(targetPath);
      setSearchQuery(null);
      setNativeNostrUri(null);
      setNativeTitle("Nostr");
      window.location.hash = buildAuraSiteHash(
        npub,
        targetPath,
        canonicalSiteName,
      );
    }
  }

  function handleSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;

    setActiveSite(null);
    setCurrentNpub(null);
    setCurrentSiteName(null);
    setCurrentPath(trimmed);
    setCurrentPetname(null);
    setSearchQuery(trimmed);
    setNativeNostrUri(null);
    setNativeTitle("Nostr");
    window.location.hash = buildAuraSearchHash(trimmed);
  }

  function handleOpenNostr(uri: string) {
    setShowSettings(false);
    setActiveSite(null);
    setCurrentNpub(null);
    setCurrentSiteName(null);
    setCurrentPath("Nostr");
    setCurrentPetname(null);
    setSearchQuery(null);
    setNativeNostrUri(uri);
    setNativeTitle("Nostr");
    window.location.hash = buildAuraNostrHash(uri);
  }

  function goHome() {
    setThemeColor(null);
    setSearchQuery(null);
    setNativeNostrUri(null);
    setNativeTitle("Nostr");
    setCurrentSiteName(null);
    setShowSettings(false);
    window.location.hash = "";
  }

  function goBack() {
    window.history.back();
  }

  function goForward() {
    window.history.forward();
  }

  function reloadSite() {
    if (activeSite) {
      setReloadNonce((value) => value + 1);
      return;
    }

    if (searchQuery) {
      setSearchNonce((value) => value + 1);
    }
  }

  async function installApp() {
    if (!installPrompt) return;

    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (
        typeof event.data === "object" &&
        event.data !== null &&
        event.data.type === "aura:theme-color" &&
        typeof event.data.color === "string" &&
        /^#[0-9a-fA-F]{3,8}$/.test(event.data.color)
      ) {
        setThemeColor(event.data.color);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function handleBlockPubkey(pubkeyToBlock: string) {
    await publishMuteListEntry(pubkeyToBlock);
  }

  function handleOpenSettings() {
    window.location.hash = buildAuraSettingsHash();
  }

  function handleLogout() {
    logout();
    setPubkey(null);
    setProfilePicture(null);
    goHome();
  }

  return (
    <div class={`aura-shell ${isStandalone ? "aura-shell--standalone" : ""}`}>
      <header
        class={`aura-topbar ${isStandalone ? "aura-topbar--app" : ""}`}
        style={
          themeColor
            ? ({ "--topbar-accent": themeColor } as preact.JSX.CSSProperties)
            : undefined
        }
      >
        <div class="aura-titlebar">
          {!isStandalone ? (
            <div class="aura-brand">
              <span class="aura-kicker">Aura</span>
              <span class="aura-tagline">Nostr-native web container</span>
            </div>
          ) : null}
          {isStandalone ? (
            <div class="aura-window-title">
              <span class="aura-window-title-label">{activeSiteLabel}</span>
              {activeSite ? (
                <span class="aura-window-title-path">
                  {currentSitePathLabel}
                </span>
              ) : (
                <span class="aura-window-title-path">Home</span>
              )}
            </div>
          ) : null}
        </div>

        <div class="nav-controls">
          <button
            type="button"
            onClick={goBack}
            disabled={!activeSite}
            class="icon-button"
            aria-label="Back"
            title="Back"
          >
            <Icon name="back" />
            <span class="sr-only">Back</span>
          </button>
          <button
            type="button"
            onClick={goForward}
            disabled={!activeSite}
            class="icon-button"
            aria-label="Forward"
            title="Forward"
          >
            <Icon name="forward" />
            <span class="sr-only">Forward</span>
          </button>
          <button
            type="button"
            onClick={goHome}
            disabled={!canGoHome}
            class="icon-button"
            aria-label="Home"
            title="Home"
          >
            <Icon name="home" />
            <span class="sr-only">Home</span>
          </button>
          <button
            type="button"
            onClick={reloadSite}
            disabled={!activeSite}
            class="icon-button"
            aria-label="Reload"
            title="Reload"
          >
            <Icon name="reload" />
            <span class="sr-only">Reload</span>
          </button>
          {!isStandalone && installPrompt ? (
            <button type="button" onClick={installApp}>
              Install Aura
            </button>
          ) : null}
          {pubkey ? (
            <button
              type="button"
              class={`avatar-button ${showSettings ? "is-active" : ""}`}
              onClick={handleOpenSettings}
              aria-label="Open settings"
              title="Open settings"
            >
              <Avatar
                pubkey={pubkey}
                src={profilePicture}
                label={currentPetname ?? currentNpub ?? "Signed in user"}
              />
            </button>
          ) : null}
        </div>

        {pubkey ? (
          <AddressBar
            currentNpub={currentNpub}
            currentPetname={currentPetname}
            currentSearchQuery={searchQuery}
            onNavigate={handleNavigate}
            onSearch={handleSearch}
            onOpenNostr={handleOpenNostr}
          />
        ) : null}
      </header>

      <main
        class={`aura-stage ${showSettings ? "aura-stage--scroll" : ""}`}
      >
        {activeSite ? (
          <section class="site-shell">
            <SiteFrame
              npub={activeSite.npub}
              siteName={activeSite.siteName}
              path={activeSite.path}
              frameKey={`${activeSite.npub}:${activeSite.siteName ?? ""}:${activeSite.path}:${reloadNonce}`}
            />
          </section>
        ) : showSettings && pubkey ? (
          <SettingsPage
            pubkey={pubkey}
            profilePicture={profilePicture}
            onLogout={handleLogout}
            onClose={goBack}
          />
        ) : searchQuery ? (
          <SearchPage
            key={`${searchQuery}:${searchNonce}`}
            query={searchQuery}
            currentPubkey={pubkey}
            onOpenSite={handleNavigate}
            onOpenNostr={handleOpenNostr}
            onBlockPubkey={handleBlockPubkey}
          />
        ) : nativeNostrUri ? (
          <NostrObjectPage
            uri={nativeNostrUri}
            onResolvedTitle={setNativeTitle}
          />
        ) : (
          <section class="launch-card">
            <div class="launch-copy">
              <p class="auth-eyebrow">Browser mode</p>
              <h1>Open a Nostr site in the browser</h1>
              <p>
                Aura keeps the browser chrome visible for normal sites, with
                back, forward, reload, and address entry in the shell.
              </p>
              <p class="launch-hint">
                Enter an `npub` or petname above, or open one of the recent
                sites below.
              </p>
            </div>
            <aside class="launch-rail" aria-label="Shell summary">
              <div class="launch-rail-card">
                <span class="launch-rail-label">Session</span>
                <strong>{pubkey ? "Signed in" : "Waiting to sign in"}</strong>
                <span>
                  {pubkey
                    ? "Signer connected, shell ready"
                    : "Choose a signer to continue"}
                </span>
              </div>
              <div class="launch-rail-card">
                <span class="launch-rail-label">Recents</span>
                <strong>{displayedRecentSites.length}</strong>
                <span>Stored locally for quick reopen</span>
              </div>
              <div class="launch-rail-card">
                <span class="launch-rail-label">Browser</span>
                <strong>Native</strong>
                <span>History, extensions, address bar</span>
              </div>
            </aside>
            {displayedRecentSites.length > 0 ? (
              <div class="recent-sites">
                <div class="recent-sites-header">
                  <span>Recent sites</span>
                  <span>{displayedRecentSites.length}</span>
                </div>
                <div class="recent-sites-list">
                  {displayedRecentSites.map((site) => (
                    <button
                      key={`${site.npub}:${site.siteName ?? ""}:${site.path}`}
                      type="button"
                      class="recent-site"
                      onClick={() =>
                        handleNavigate(site.npub, site.path, site.siteName)
                      }
                    >
                      <strong>{site.label}</strong>
                      {site.description ? (
                        <span>{site.description}</span>
                      ) : null}
                      <span>
                        {site.path} · {site.npub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p class="launch-status">No sites visited yet.</p>
            )}
            {currentNpub ? (
              <p class="launch-status">
                Last target: {currentPetname ?? currentNpub}
              </p>
            ) : null}
          </section>
        )}
      </main>

      {!pubkey ? (
        <AuthPanel
          onAuthenticated={(nextPubkey) => {
            setPubkey(nextPubkey);
            syncServiceWorkerRelays();
          }}
        />
      ) : null}
    </div>
  );
}
