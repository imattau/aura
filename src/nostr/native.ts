import { nip19 } from "nostr-tools";

type NativeReferenceBase = {
  raw: string;
};

export type NativeNostrReference =
  | (NativeReferenceBase & {
      kind: "profile";
      pubkey: string;
      relays: string[];
      bech32Type: "npub" | "nprofile";
    })
  | (NativeReferenceBase & {
      kind: "event";
      id: string;
      author?: string;
      eventKind?: number;
      relays: string[];
      bech32Type: "note" | "nevent";
    })
  | (NativeReferenceBase & {
      kind: "address";
      identifier: string;
      pubkey: string;
      eventKind: number;
      relays: string[];
      bech32Type: "naddr";
    });

function stripNostrScheme(value: string): string {
  return value.replace(/^nostr:/i, "");
}

export function parseNativeNostrReference(
  value: string,
  options: { allowNpub?: boolean } = {},
): NativeNostrReference | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hadScheme = /^nostr:/i.test(trimmed);
  const decoded = hadScheme
    ? nip19.decode(stripNostrScheme(trimmed))
    : nip19.decode(trimmed);

  if (decoded.type === "npub") {
    if (!hadScheme && !options.allowNpub) return null;
    return {
      raw: trimmed,
      kind: "profile",
      pubkey: decoded.data,
      relays: [],
      bech32Type: "npub",
    };
  }

  if (decoded.type === "nprofile") {
    return {
      raw: trimmed,
      kind: "profile",
      pubkey: decoded.data.pubkey,
      relays: decoded.data.relays ?? [],
      bech32Type: "nprofile",
    };
  }

  if (decoded.type === "nevent") {
    return {
      raw: trimmed,
      kind: "event",
      id: decoded.data.id,
      author: decoded.data.author,
      eventKind: decoded.data.kind,
      relays: decoded.data.relays ?? [],
      bech32Type: "nevent",
    };
  }

  if (decoded.type === "note") {
    return {
      raw: trimmed,
      kind: "event",
      id: decoded.data,
      relays: [],
      bech32Type: "note",
    };
  }

  if (decoded.type === "naddr") {
    return {
      raw: trimmed,
      kind: "address",
      identifier: decoded.data.identifier,
      pubkey: decoded.data.pubkey,
      eventKind: decoded.data.kind,
      relays: decoded.data.relays ?? [],
      bech32Type: "naddr",
    };
  }

  return null;
}
