import { nip19 } from "nostr-tools";
import { describe, expect, it } from "vitest";
import { parseNativeNostrReference } from "./native";

describe("parseNativeNostrReference", () => {
  it("parses native nprofile URIs", () => {
    const uri = `nostr:${nip19.nprofileEncode({ pubkey: "a".repeat(64) })}`;
    const reference = parseNativeNostrReference(uri);

    expect(reference?.kind).toBe("profile");
    expect(reference?.bech32Type).toBe("nprofile");
    expect(reference?.pubkey).toBe("a".repeat(64));
  });

  it("parses native nevent URIs", () => {
    const uri = `nostr:${nip19.neventEncode({ id: "b".repeat(64) })}`;
    const reference = parseNativeNostrReference(uri);

    expect(reference?.kind).toBe("event");
    expect(reference?.bech32Type).toBe("nevent");
    expect(reference?.id).toBe("b".repeat(64));
  });

  it("parses native naddr URIs", () => {
    const uri = `nostr:${nip19.naddrEncode({
      identifier: "demo",
      pubkey: "c".repeat(64),
      kind: 30023,
    })}`;
    const reference = parseNativeNostrReference(uri);

    expect(reference?.kind).toBe("address");
    expect(reference?.bech32Type).toBe("naddr");
    expect(reference?.identifier).toBe("demo");
  });
});
