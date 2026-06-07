import { nip19 } from "nostr-tools";
import { useEffect, useState } from "preact/hooks";
import { getPoolRelayUrls } from "../../nostr/pool";
import { fetchFollowingList } from "../../nostr/queries";
import type { SearchHit } from "../../nostr/search";
import { searchNostrContent } from "../../nostr/search";
import { blockPubkey, listBlockedPubkeys } from "../stores/moderation";
import { Icon } from "./Icon";

interface Props {
  query: string;
  currentPubkey: string | null;
  onOpenSite: (npub: string, path: string, siteName?: string | null) => void;
  onOpenNostr: (uri: string) => void;
  onBlockPubkey: (pubkey: string) => Promise<void>;
}

type SearchFilterKind = "all" | "site" | "article" | "note" | "user";

export function SearchPage({
  query,
  currentPubkey,
  onOpenSite,
  onOpenNostr,
  onBlockPubkey,
}: Props) {
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<SearchFilterKind>("all");
  const [followOnly, setFollowOnly] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);
  const [blockedPubkeys, setBlockedPubkeys] = useState<string[]>(() =>
    listBlockedPubkeys(),
  );

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      const trimmed = query.trim();
      if (!trimmed) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const hits = await searchNostrContent(trimmed);
        if (cancelled) return;
        setResults(hits);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : String(caught));
        setResults([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowing() {
      if (!currentPubkey) {
        setFollowing([]);
        return;
      }

      try {
        const list = await fetchFollowingList(currentPubkey);
        if (!cancelled) setFollowing(list);
      } catch {
        if (!cancelled) setFollowing([]);
      }
    }

    void loadFollowing();

    return () => {
      cancelled = true;
    };
  }, [currentPubkey]);

  const relayUrls = getPoolRelayUrls();
  const followingSet = new Set(following);
  const blockedSet = new Set(blockedPubkeys);
  const filteredResults = results.filter((result) => {
    const matchesType =
      filterKind === "all" || result.resultKind === filterKind;
    const matchesFollowing = !followOnly || followingSet.has(result.pubkey);
    const isBlocked = blockedSet.has(result.pubkey);
    return matchesType && matchesFollowing && !isBlocked;
  });

  const hiddenByBlocklist = results.filter((result) =>
    blockedSet.has(result.pubkey),
  ).length;

  async function handleBlock(result: SearchHit) {
    blockPubkey(result.pubkey);
    setBlockedPubkeys(listBlockedPubkeys());
    setActionStatus(`Blocked ${result.npub}.`);

    try {
      await onBlockPubkey(result.pubkey);
      setActionStatus(`Updated your blocklist for ${result.npub}.`);
    } catch (caught) {
      const remoteFailure =
        caught instanceof Error
          ? `, but could not update your relay blocklist: ${caught.message}`
          : ".";
      setActionStatus(`${result.npub} blocked locally${remoteFailure}`);
    }
  }

  async function handleReport(result: SearchHit) {
    const payload = [
      "Aura search report",
      `query: ${query.trim()}`,
      `kind: ${result.kind} (${result.kindLabel})`,
      `title: ${result.title}`,
      `npub: ${result.npub}`,
      `pubkey: ${result.pubkey}`,
      `resultKind: ${result.resultKind}`,
      result.path ? `path: ${result.path}` : null,
      "",
      "Paste this into your moderation workflow.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      setActionStatus(`Copied report payload for ${result.npub}.`);
    } catch {
      setActionStatus(`Could not copy the report payload for ${result.npub}.`);
    }
  }

  function buildNativeUri(result: SearchHit): string {
    if (result.resultKind === "site" || result.resultKind === "user") {
      return `nostr:${nip19.nprofileEncode({ pubkey: result.pubkey })}`;
    }

    if (result.resultKind === "note") {
      return `nostr:${nip19.noteEncode(result.id)}`;
    }

    return `nostr:${nip19.neventEncode({
      id: result.id,
      author: result.pubkey,
      kind: result.kind,
    })}`;
  }

  function renderResult(result: SearchHit) {
    return (
      <li class={`search-result search-result--${result.resultKind}`}>
        <div class="search-result-header">
          <div class="search-result-header-copy">
            <span class="search-result-kind">{result.kindLabel}</span>
            <span class="search-result-pubkey">{result.npub}</span>
            <span class="search-result-kind-code">kind {result.kind}</span>
          </div>
          <div class="search-result-actions">
            {result.resultKind === "site" ? (
              <button
                type="button"
                class="search-result-action search-result-action--open"
                onClick={() =>
                  onOpenSite(result.npub, result.path ?? "/", result.siteName)
                }
                aria-label="Open site"
                title="Open site"
              >
                <Icon name="go" />
              </button>
            ) : (
              <button
                type="button"
                class="search-result-action search-result-action--open"
                onClick={() => onOpenNostr(buildNativeUri(result))}
                aria-label={
                  result.resultKind === "user" ? "Open profile" : "Open event"
                }
                title={
                  result.resultKind === "user" ? "Open profile" : "Open event"
                }
              >
                <Icon name="go" />
              </button>
            )}
            <button
              type="button"
              class="search-result-action"
              onClick={() => handleBlock(result)}
              aria-label={`Block ${result.npub}`}
              title={`Block ${result.npub}`}
            >
              <Icon name="block" />
            </button>
            <button
              type="button"
              class="search-result-action"
              onClick={() => handleReport(result)}
              aria-label={`Report ${result.npub}`}
              title={`Report ${result.npub}`}
            >
              <Icon name="report" />
            </button>
          </div>
        </div>
        <div class="search-result-body">
          {result.resultKind === "site" ? (
            <button
              type="button"
              class="search-result-link"
              onClick={() =>
                onOpenSite(result.npub, result.path ?? "/", result.siteName)
              }
            >
              {result.title}
            </button>
          ) : (
            <button
              type="button"
              class="search-result-link"
              onClick={() => onOpenNostr(buildNativeUri(result))}
            >
              {result.title}
            </button>
          )}
          <p class="search-result-snippet">{result.summary}</p>
        </div>
        <div class="search-result-footer">
          <span class="search-result-type">
            {result.resultKind === "user" ? "Profile" : result.kindLabel}
          </span>
          <span class="search-result-route">
            {result.resultKind === "site" && result.siteName
              ? `${result.siteName}${result.path ?? ""}`
              : result.path ?? "Result"}
          </span>
        </div>
      </li>
    );
  }

  return (
    <section class="search-page" aria-label="Search results">
      <div class="search-hero">
        <div>
          <p class="auth-eyebrow">Relay search</p>
          <h1>Results for {query}</h1>
          <p>
            Searching Aura pages, long-form posts, notes, people, and other
            indexed Nostr content from the configured relays.
          </p>
        </div>
        <div class="search-hero-meta">
          <span>{filteredResults.length} results</span>
          <span>
            {relayUrls.length > 0 ? relayUrls.length : 3} relays checked
          </span>
        </div>
      </div>

      <div class="search-meta">
        <span>
          Relay-backed search uses the current pool configuration.
          {followOnly ? " Following filter enabled." : ""}
        </span>
        {hiddenByBlocklist > 0 ? (
          <span>
            {hiddenByBlocklist} blocked result
            {hiddenByBlocklist === 1 ? "" : "s"} hidden.
          </span>
        ) : null}
      </div>

      <div class="search-filters" role="toolbar" aria-label="Search filters">
        <button
          type="button"
          class={`search-filter${filterKind === "all" ? " is-active" : ""}`}
          aria-pressed={filterKind === "all"}
          onClick={() => setFilterKind("all")}
        >
          All
        </button>
        <button
          type="button"
          class={`search-filter${filterKind === "site" ? " is-active" : ""}`}
          aria-pressed={filterKind === "site"}
          onClick={() => setFilterKind("site")}
        >
          Sites
        </button>
        <button
          type="button"
          class={`search-filter${filterKind === "article" ? " is-active" : ""}`}
          aria-pressed={filterKind === "article"}
          onClick={() => setFilterKind("article")}
        >
          Articles
        </button>
        <button
          type="button"
          class={`search-filter${filterKind === "note" ? " is-active" : ""}`}
          aria-pressed={filterKind === "note"}
          onClick={() => setFilterKind("note")}
        >
          Notes
        </button>
        <button
          type="button"
          class={`search-filter${filterKind === "user" ? " is-active" : ""}`}
          aria-pressed={filterKind === "user"}
          onClick={() => setFilterKind("user")}
        >
          Users
        </button>
        <button
          type="button"
          class={`search-filter search-filter--following${
            followOnly ? " is-active" : ""
          }`}
          aria-pressed={followOnly}
          disabled={!currentPubkey}
          onClick={() => setFollowOnly((value) => !value)}
        >
          Following
        </button>
      </div>

      {loading ? <p class="search-status">Searching relays...</p> : null}
      {error ? <p class="search-status search-status--error">{error}</p> : null}
      {actionStatus ? <p class="search-status">{actionStatus}</p> : null}

      {!loading && !error && filteredResults.length === 0 ? (
        <div class="search-empty">
          <strong>No matches found</strong>
          <p>Try a different term or change the active filter.</p>
        </div>
      ) : null}

      {filteredResults.length > 0 ? (
        <ol class="search-results">{filteredResults.map(renderResult)}</ol>
      ) : null}
    </section>
  );
}
