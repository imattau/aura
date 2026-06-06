import { useState } from "preact/hooks";
import { resolveNpub } from "../stores/petnames";
import { Icon } from "./Icon";

interface Props {
  currentNpub: string | null;
  currentPetname: string | null;
  currentSearchQuery: string | null;
  onNavigate: (npub: string, path: string) => void;
  onSearch: (query: string) => void;
}

export function AddressBar({
  currentNpub,
  currentPetname,
  currentSearchQuery,
  onNavigate,
  onSearch,
}: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(event: Event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    let npub: string;
    if (trimmed.startsWith("npub1")) {
      npub = trimmed;
    } else {
      const resolved = resolveNpub(trimmed);
      if (resolved) {
        npub = resolved;
      } else {
        setInput("");
        onSearch(trimmed);
        return;
      }
    }

    setInput("");
    onNavigate(npub, "/");
  }

  const displayLabel =
    currentPetname ?? currentNpub ?? currentSearchQuery ?? "";

  return (
    <form class="address-bar" onSubmit={handleSubmit}>
      {displayLabel && <span class="current-site">{displayLabel}</span>}
      <input
        type="text"
        placeholder="npub1..., site name, or search"
        value={input}
        onInput={(event) => setInput((event.target as HTMLInputElement).value)}
      />
      <button type="submit" class="icon-button" aria-label="Go" title="Go">
        <Icon name="go" />
        <span class="sr-only">Go</span>
      </button>
    </form>
  );
}
