import type { NostrEvent } from "nostr-tools";
import { useEffect, useState } from "preact/hooks";
import { parseNativeNostrReference } from "../../nostr/native";
import {
  fetchAddressableEvent,
  fetchEventById,
  fetchProfile,
} from "../../nostr/queries";
import { Avatar } from "./Avatar";

interface Props {
  uri: string;
  onResolvedTitle: (title: string) => void;
}

type ProfileContent = {
  name?: unknown;
  about?: unknown;
  picture?: unknown;
  website?: unknown;
  lud16?: unknown;
  nip05?: unknown;
};

function formatTimestamp(createdAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt * 1000));
}

function summarizeEventContent(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
      ?.slice(0, 280)
      .trim() ?? ""
  );
}

function readProfile(event: NostrEvent): ProfileContent | null {
  try {
    return JSON.parse(event.content) as ProfileContent;
  } catch {
    return null;
  }
}

export function NostrObjectPage({ uri, onResolvedTitle }: Props) {
  const [event, setEvent] = useState<NostrEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const reference = parseNativeNostrReference(uri, { allowNpub: true });
      if (!reference) {
        if (!cancelled) {
          setEvent(null);
          setError("Unsupported Nostr reference.");
          setLoading(false);
        }
        return;
      }

      try {
        let resolved: NostrEvent | null = null;
        if (reference.kind === "profile") {
          resolved = await fetchProfile(reference.pubkey);
        } else if (reference.kind === "event") {
          resolved = await fetchEventById(reference.id);
        } else if (reference.kind === "address") {
          resolved = await fetchAddressableEvent({
            pubkey: reference.pubkey,
            kind: reference.eventKind,
            identifier: reference.identifier,
          });
        }

        if (cancelled) return;
        setEvent(resolved);

        if (reference.kind === "profile") {
          const profile = resolved ? readProfile(resolved) : null;
          const title =
            (typeof profile?.name === "string" && profile.name.trim()) ||
            `npub:${reference.pubkey.slice(0, 12)}…`;
          onResolvedTitle(title);
          return;
        }

        if (!resolved) {
          onResolvedTitle("Nostr object");
          return;
        }

        const firstLine = summarizeEventContent(resolved.content);
        onResolvedTitle(firstLine || `Kind ${resolved.kind}`);
      } catch (caught) {
        if (cancelled) return;
        setEvent(null);
        setError(caught instanceof Error ? caught.message : String(caught));
        onResolvedTitle("Nostr object");
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
  }, [onResolvedTitle, uri]);

  const reference = parseNativeNostrReference(uri, { allowNpub: true });

  return (
    <section class="nostr-object-page" aria-label="Native Nostr object">
      <div class="nostr-object-hero">
        <div>
          <p class="auth-eyebrow">Native Nostr</p>
          <h1>
            {reference?.kind === "profile"
              ? "Profile"
              : reference?.kind === "address"
                ? "Addressable event"
                : "Event"}
          </h1>
          <p>
            Rendered directly inside Aura from a Nostr URI instead of a hosted
            site.
          </p>
        </div>
        <div class="nostr-object-meta">
          <span>{reference?.bech32Type ?? "nostr"}</span>
          <span>
            {loading ? "Resolving" : event ? `kind ${event.kind}` : "Missing"}
          </span>
        </div>
      </div>

      {error ? <p class="search-status search-status--error">{error}</p> : null}
      {loading ? <p class="search-status">Loading Nostr object…</p> : null}

      {!loading && !error && reference?.kind === "profile" ? (
        <article class="nostr-profile">
          <div class="nostr-profile-head">
            <Avatar
              pubkey={reference.pubkey}
              src={
                event
                  ? (() => {
                      const profile = readProfile(event);
                      return typeof profile?.picture === "string"
                        ? profile.picture
                        : null;
                    })()
                  : null
              }
              label={`npub:${reference.pubkey.slice(0, 12)}…`}
            />
            <div>
              <h2>
                {event
                  ? (() => {
                      const profile = readProfile(event);
                      return typeof profile?.name === "string" &&
                        profile.name.trim()
                        ? profile.name
                        : `npub:${reference.pubkey.slice(0, 12)}…`;
                    })()
                  : `npub:${reference.pubkey.slice(0, 12)}…`}
              </h2>
              <p class="nostr-object-pubkey">{reference.pubkey}</p>
            </div>
          </div>

          <div class="nostr-object-detail-grid">
            <div>
              <span class="nostr-object-label">About</span>
              <p>
                {event
                  ? (() => {
                      const profile = readProfile(event);
                      return typeof profile?.about === "string" &&
                        profile.about.trim()
                        ? profile.about
                        : "No profile description.";
                    })()
                  : "No profile description."}
              </p>
            </div>
            <div>
              <span class="nostr-object-label">Website</span>
              <p>
                {event
                  ? (() => {
                      const profile = readProfile(event);
                      return typeof profile?.website === "string" &&
                        profile.website.trim()
                        ? profile.website
                        : "Not published.";
                    })()
                  : "Not published."}
              </p>
            </div>
            <div>
              <span class="nostr-object-label">NIP-05</span>
              <p>
                {event
                  ? (() => {
                      const profile = readProfile(event);
                      return typeof profile?.nip05 === "string" &&
                        profile.nip05.trim()
                        ? profile.nip05
                        : "Not published.";
                    })()
                  : "Not published."}
              </p>
            </div>
            <div>
              <span class="nostr-object-label">Lud16</span>
              <p>
                {event
                  ? (() => {
                      const profile = readProfile(event);
                      return typeof profile?.lud16 === "string" &&
                        profile.lud16.trim()
                        ? profile.lud16
                        : "Not published.";
                    })()
                  : "Not published."}
              </p>
            </div>
          </div>
        </article>
      ) : null}

      {!loading && !error && reference?.kind !== "profile" && event ? (
        <article class="nostr-event">
          <div class="nostr-event-head">
            <div>
              <span class="nostr-object-label">
                {event.kind === 1 ? "Note" : `Kind ${event.kind}`}
              </span>
              <h2>{summarizeEventContent(event.content) || "Nostr event"}</h2>
              <p class="nostr-object-pubkey">
                {reference.kind === "address"
                  ? `d=${reference.identifier} · ${reference.pubkey}`
                  : event.id}
              </p>
            </div>
            <div class="nostr-object-meta">
              <span>{formatTimestamp(event.created_at)}</span>
              <span>
                {reference.relays.length > 0 ? reference.relays.length : 0}{" "}
                relays
              </span>
            </div>
          </div>

          <pre class="nostr-event-content">{event.content}</pre>
          <div class="nostr-event-tags" aria-label="Event tags">
            {event.tags.map((tag, index) => (
              <span key={`${event.id}:${index}`} class="nostr-event-tag">
                {tag.join(" · ")}
              </span>
            ))}
          </div>
        </article>
      ) : null}

      {!loading && !error && !event ? (
        <div class="search-empty">
          <strong>Nothing found</strong>
          <p>
            The referenced Nostr object was not available in the current pool.
          </p>
        </div>
      ) : null}

      <div class="nostr-object-scheme">
        <span>URI</span>
        <code>{uri}</code>
      </div>
    </section>
  );
}
