import { useState } from "preact/hooks";
import { parseNativeNostrReference } from "../../nostr/native";
import { parseAuraAddress } from "../addressing";
import { Icon } from "./Icon";

interface Props {
  currentNpub: string | null;
  currentPetname: string | null;
  currentSearchQuery: string | null;
  onNavigate: (
    npub: string,
    path: string,
    siteName?: string | null,
  ) => void;
  onSearch: (query: string) => void;
  onOpenNostr: (uri: string) => void;
}

export function AddressBar({
  currentNpub,
  currentPetname,
  currentSearchQuery,
  onNavigate,
  onSearch,
  onOpenNostr,
}: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(event: Event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const auraAddress = parseAuraAddress(trimmed);
    if (auraAddress) {
      setInput("");
      onNavigate(auraAddress.npub, auraAddress.path, auraAddress.siteName);
      return;
    }

    if (trimmed.startsWith("nostr:")) {
      const nativeReference = parseNativeNostrReference(trimmed);
      if (nativeReference) {
        setInput("");
        onOpenNostr(trimmed);
        return;
      }
    }

    setInput("");
    onSearch(trimmed);
  }

  const displayLabel =
    currentPetname ?? currentNpub ?? currentSearchQuery ?? "";

  return (
    <form class="address-bar" onSubmit={handleSubmit}>
      {displayLabel && <span class="current-site">{displayLabel}</span>}
      <input
        type="text"
        placeholder="~npub/site-name/index.html or search"
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
