import type { NostrEvent } from "nostr-tools";
import { useEffect, useState } from "preact/hooks";
import { DEFAULT_BLOSSOM_SERVERS } from "../../blossom/constants";
import { DEFAULT_RELAYS } from "../../nostr/constants";
import { fetchBlossomServers, fetchProfile, fetchRelayList } from "../../nostr/queries";
import { getAuthState, refreshRelaySubscription } from "../stores/auth";
import {
  getSettingsState,
  setRelaySubscriptionMode,
  type RelaySubscriptionMode,
} from "../stores/settings";
import { Avatar } from "./Avatar";

type ProfileData = {
  name: string | null;
  about: string | null;
  picture: string | null;
  website: string | null;
  nip05: string | null;
  lud16: string | null;
};

interface Props {
  pubkey: string;
  profilePicture: string | null;
  onLogout: () => void;
  onClose: () => void;
}

function readProfile(event: NostrEvent | null): ProfileData {
  if (!event) {
    return {
      name: null,
      about: null,
      picture: null,
      website: null,
      nip05: null,
      lud16: null,
    };
  }

  try {
    const parsed = JSON.parse(event.content) as Partial<ProfileData>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : null,
      about: typeof parsed.about === "string" ? parsed.about : null,
      picture: typeof parsed.picture === "string" ? parsed.picture : null,
      website: typeof parsed.website === "string" ? parsed.website : null,
      nip05: typeof parsed.nip05 === "string" ? parsed.nip05 : null,
      lud16: typeof parsed.lud16 === "string" ? parsed.lud16 : null,
    };
  } catch {
    return {
      name: null,
      about: null,
      picture: null,
      website: null,
      nip05: null,
      lud16: null,
    };
  }
}

function formatRelayList(relays: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const relay of relays) {
    const trimmed = relay.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function ModeCard({
  mode,
  currentMode,
  title,
  description,
  onSelect,
}: {
  mode: RelaySubscriptionMode;
  currentMode: RelaySubscriptionMode;
  title: string;
  description: string;
  onSelect: (mode: RelaySubscriptionMode) => void;
}) {
  return (
    <button
      type="button"
      class={`settings-mode-card ${currentMode === mode ? "is-active" : ""}`}
      onClick={() => onSelect(mode)}
      aria-pressed={currentMode === mode}
    >
      <span class="settings-mode-title">{title}</span>
      <span class="settings-mode-copy">{description}</span>
    </button>
  );
}

export function SettingsPage({
  pubkey,
  profilePicture,
  onLogout,
  onClose,
}: Props) {
  const [profile, setProfile] = useState<ProfileData>({
    name: null,
    about: null,
    picture: profilePicture,
    website: null,
    nip05: null,
    lud16: null,
  });
  const [userRelays, setUserRelays] = useState<string[]>([]);
  const [blossomRelays, setBlossomRelays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relayMode, setRelayMode] = useState<RelaySubscriptionMode>(
    getSettingsState().relaySubscriptionMode,
  );
  const [openSections, setOpenSections] = useState({
    profile: true,
    relayMode: false,
    userRelays: false,
    blossomRelays: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [profileEvent, relayList, blossomList] = await Promise.all([
          fetchProfile(pubkey),
          fetchRelayList(pubkey),
          fetchBlossomServers(pubkey),
        ]);

        if (cancelled) return;

        const parsedProfile = readProfile(profileEvent);
        setProfile({
          ...parsedProfile,
          picture: parsedProfile.picture ?? profilePicture,
        });
        setUserRelays(formatRelayList(relayList));
        setBlossomRelays(formatRelayList(blossomList));
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [profilePicture, pubkey]);

  function handleModeChange(nextMode: RelaySubscriptionMode) {
    setRelayMode(nextMode);
    setRelaySubscriptionMode(nextMode);
    refreshRelaySubscription();
  }

  function toggleSection(
    section: keyof typeof openSections,
  ): void {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  const authState = getAuthState();
  const displayName =
    profile.name?.trim() ||
    profile.nip05?.trim() ||
    `npub:${pubkey.slice(0, 12)}…`;
  const avatarSrc = profile.picture ?? profilePicture;
  const effectiveUserRelays =
    userRelays.length > 0 ? userRelays : DEFAULT_RELAYS;
  const effectiveBlossomRelays =
    blossomRelays.length > 0 ? blossomRelays : DEFAULT_BLOSSOM_SERVERS;

  return (
    <section class="settings-page" aria-label="Account settings">
      <header class="settings-hero">
        <div class="settings-identity">
          <Avatar
            pubkey={pubkey}
            src={avatarSrc}
            label={displayName}
          />
          <div class="settings-identity-copy">
            <p class="auth-eyebrow">Account settings</p>
            <h1>{displayName}</h1>
            <p class="settings-subtitle">
              Manage your profile, relays, and local Aura subscription mode.
            </p>
            <div class="settings-meta">
              <span>Signed in</span>
              <span>{`Following ${authState.following.length}`}</span>
              <span>{pubkey}</span>
            </div>
          </div>
        </div>

        <div class="settings-actions">
          <button type="button" class="ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" class="danger" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {error ? <p class="settings-status settings-status--error">{error}</p> : null}
      {loading ? <p class="settings-status">Loading account data…</p> : null}

      <div class="settings-sections">
        <section class="settings-section">
          <button
            type="button"
            class="settings-section-summary"
            onClick={() => toggleSection("profile")}
            aria-expanded={openSections.profile}
          >
            <div>
              <p class="settings-card-kicker">Profile</p>
              <h2>Public identity</h2>
            </div>
            <span class="settings-section-indicator" aria-hidden="true">
              {openSections.profile ? "−" : "+"}
            </span>
          </button>
          {openSections.profile ? (
            <div class="settings-section-content">
            <dl class="settings-profile-grid">
              <div>
                <dt>Name</dt>
                <dd>{profile.name ?? "Not published"}</dd>
              </div>
              <div>
                <dt>About</dt>
                <dd>{profile.about ?? "No description published."}</dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>{profile.website ?? "Not published"}</dd>
              </div>
              <div>
                <dt>NIP-05</dt>
                <dd>{profile.nip05 ?? "Not published"}</dd>
              </div>
              <div>
                <dt>Lud16</dt>
                <dd>{profile.lud16 ?? "Not published"}</dd>
              </div>
              <div>
                <dt>Pubkey</dt>
                <dd class="settings-code">{pubkey}</dd>
              </div>
            </dl>
            </div>
          ) : null}
        </section>

        <section class="settings-section">
          <button
            type="button"
            class="settings-section-summary"
            onClick={() => toggleSection("relayMode")}
            aria-expanded={openSections.relayMode}
          >
            <div>
              <p class="settings-card-kicker">Aura</p>
              <h2>Relay subscription mode</h2>
            </div>
            <span class="settings-section-indicator" aria-hidden="true">
              {openSections.relayMode ? "−" : "+"}
            </span>
          </button>
          {openSections.relayMode ? (
            <div class="settings-section-content">
            <p class="settings-card-copy">
              Choose how much data Aura keeps warm in the local index.
            </p>
            <div
              class="settings-mode-list"
              role="radiogroup"
              aria-label="Aura relay subscription mode"
            >
              <ModeCard
                mode="global"
                currentMode={relayMode}
                title="Global"
                description="Subscribe to the full ingress feed from the configured relay pool."
                onSelect={handleModeChange}
              />
              <ModeCard
                mode="following"
                currentMode={relayMode}
                title="Following only"
                description="Only keep Aura warm for you and the pubkeys you follow."
                onSelect={handleModeChange}
              />
              <ModeCard
                mode="global-following"
                currentMode={relayMode}
                title="Hybrid"
                description="Keep both the global feed and your following graph synced."
                onSelect={handleModeChange}
              />
            </div>
            </div>
          ) : null}
        </section>

        <section class="settings-section">
          <button
            type="button"
            class="settings-section-summary"
            onClick={() => toggleSection("userRelays")}
            aria-expanded={openSections.userRelays}
          >
            <div>
              <p class="settings-card-kicker">Relays</p>
              <h2>User relays</h2>
            </div>
            <span class="settings-section-indicator" aria-hidden="true">
              {openSections.userRelays ? "−" : "+"}
            </span>
          </button>
          {openSections.userRelays ? (
            <div class="settings-section-content">
            <p class="settings-card-copy">
              Relays published in your NIP-65 relay list. Aura uses these
              first, then falls back to defaults.
            </p>
            <ul class="settings-list">
              {effectiveUserRelays.map((relay) => (
                <li key={relay}>
                  <code>{relay}</code>
                </li>
              ))}
            </ul>
            </div>
          ) : null}
        </section>

        <section class="settings-section">
          <button
            type="button"
            class="settings-section-summary"
            onClick={() => toggleSection("blossomRelays")}
            aria-expanded={openSections.blossomRelays}
          >
            <div>
              <p class="settings-card-kicker">Blossom</p>
              <h2>Blossom relays</h2>
            </div>
            <span class="settings-section-indicator" aria-hidden="true">
              {openSections.blossomRelays ? "−" : "+"}
            </span>
          </button>
          {openSections.blossomRelays ? (
            <div class="settings-section-content">
            <p class="settings-card-copy">
              BUD-03 servers that Aura can use for blob fetching, with defaults
              as a fallback.
            </p>
            <ul class="settings-list">
              {effectiveBlossomRelays.map((relay) => (
                <li key={relay}>
                  <code>{relay}</code>
                </li>
              ))}
            </ul>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
