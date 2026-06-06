import * as preact from "preact";
import { useEffect, useState } from "preact/hooks";
import { DEMO_SITE_NPUB } from "../demo/constants";
import { getPool, getPoolRelayUrls } from "../nostr/pool";
import { fetchManifest, fetchProfile } from "../nostr/queries";
import { parseManifestMetadata } from "../sw/manifest";
import { AddressBar } from "./components/AddressBar";
import { AuthPanel } from "./components/AuthPanel";
import { Avatar } from "./components/Avatar";
import { Icon } from "./components/Icon";
import { SearchPage } from "./components/SearchPage";
import { SiteFrame } from "./components/SiteFrame";
import {
  buildAuraSearchHash,
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
  preferredLabel: string | null | undefined,
  sites: RecentSite[],
): string {
  if (preferredLabel) return preferredLabel;
  const recent = sites.find((site) => site.npub === npub && site.path === path);
  return recent?.label ?? npub;
}

export function App() {
  const [pubkey, setPubkey] = useState<string | null>(() =>
    loadPersistedPubkey(),
  );
  const initialRoute = readAuraRouteFromHash(window.location.hash);
  const [activeSite, setActiveSite] = useState<{
    npub: string;
    path: string;
  } | null>(() => (initialRoute.kind === "site" ? initialRoute : null));
  const [currentNpub, setCurrentNpub] = useState<string | null>(
    activeSite?.npub ?? null,
  );
  const [currentPath, setCurrentPath] = useState<string>(
    activeSite?.path ?? "/index.html",
  );
  const [currentPetname, setCurrentPetname] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string | null>(() =>
    initialRoute.kind === "search" ? initialRoute.query : null,
  );
  const [searchNonce, setSearchNonce] = useState(0);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [themeColor, setThemeColor] = useState<string | null>(null);
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
    currentPetname ?? currentNpub ?? (searchQuery ? "Search" : "Aura");

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
        setActiveSite(route);
        setCurrentNpub(route.npub);
        setCurrentPath(route.path);
        setSearchQuery(null);
        setCurrentPetname(
          resolveSiteLabel(route.npub, route.path, null, recentSites),
        );
        return;
      }

      if (route.kind === "search") {
        setActiveSite(null);
        setCurrentNpub(null);
        setCurrentPath(route.query || "Search");
        setCurrentPetname(null);
        setSearchQuery(route.query);
        return;
      }

      setActiveSite(null);
      setCurrentNpub(null);
      setCurrentPath("/index.html");
      setCurrentPetname(null);
      setSearchQuery(null);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [recentSites]);

  async function handleNavigate(npub: string, path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    try {
      const event = await fetchManifest(npub);
      const manifest = event ? parseManifestMetadata(event) : null;
      const name = manifest?.name ?? null;
      if (name) {
        registerPetname(name, npub);
      }
      const targetPath =
        normalizedPath === "/"
          ? (manifest?.startPath ?? "/index.html")
          : normalizedPath;
      const label = resolveSiteLabel(npub, targetPath, name, recentSites);
      setCurrentPetname(label);
      recordRecentSite(npub, targetPath, label, manifest?.description ?? null);
      setRecentSites(listRecentSites());
    } finally {
      const targetPath =
        normalizedPath === "/" ? "/index.html" : normalizedPath;
      setActiveSite({ npub, path: targetPath });
      setCurrentNpub(npub);
      setCurrentPath(targetPath);
      setSearchQuery(null);
      window.location.hash = buildAuraSiteHash(npub, targetPath);
    }
  }

  function handleSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;

    setActiveSite(null);
    setCurrentNpub(null);
    setCurrentPath(trimmed);
    setCurrentPetname(null);
    setSearchQuery(trimmed);
    window.location.hash = buildAuraSearchHash(trimmed);
  }

  function goHome() {
    setThemeColor(null);
    setSearchQuery(null);
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
      if (
        typeof event.data === "object" &&
        event.data !== null &&
        event.data.type === "aura:theme-color" &&
        typeof event.data.color === "string"
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

  return (
    <div class={`aura-shell ${isStandalone ? "aura-shell--standalone" : ""}`}>
      <header
        class={`aura-topbar ${isStandalone ? "aura-topbar--app" : ""}`}
        style={themeColor ? { "--topbar-accent": themeColor } as preact.JSX.CSSProperties : undefined}
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
                <span class="aura-window-title-path">{currentPath}</span>
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
            disabled={!activeSite}
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
          {isStandalone && pubkey ? (
            <Avatar
              pubkey={pubkey}
              src={profilePicture}
              label={currentPetname ?? currentNpub ?? "Signed in user"}
            />
          ) : null}
        </div>

        {pubkey ? (
          <AddressBar
            currentNpub={currentNpub}
            currentPetname={currentPetname}
            currentSearchQuery={searchQuery}
            onNavigate={handleNavigate}
            onSearch={handleSearch}
          />
        ) : null}
      </header>

      <main class="aura-stage">
        {activeSite ? (
          <section class="site-shell">
            <SiteFrame
              npub={activeSite.npub}
              path={activeSite.path}
              frameKey={`${activeSite.npub}:${activeSite.path}:${reloadNonce}`}
            />
          </section>
        ) : searchQuery ? (
          <SearchPage
            key={`${searchQuery}:${searchNonce}`}
            query={searchQuery}
            currentPubkey={pubkey}
            onOpenSite={handleNavigate}
            onBlockPubkey={handleBlockPubkey}
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
                      key={`${site.npub}:${site.path}`}
                      type="button"
                      class="recent-site"
                      onClick={() => handleNavigate(site.npub, site.path)}
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
