import { describe, expect, it } from "vitest";
import { createPool, getPool, getPoolRelayUrls, mergeRelayUrls } from "./pool";

describe("createPool", () => {
  it("creates a RelayPool and opens each relay", () => {
    const urls = ["wss://relay.example.com"];
    const result = createPool(urls);

    expect(result).toBeDefined();
    expect(getPoolRelayUrls()).toEqual(["wss://relay.example.com"]);
  });

  it("stores the active pool", () => {
    createPool(["wss://relay.example.com"]);
    expect(getPool()).toBeDefined();
  });

  it("exposes relay urls from the pool", () => {
    createPool(["wss://relay.example.com"]);
    expect(getPoolRelayUrls()).toEqual(["wss://relay.example.com"]);
  });

  it("merges relay lists without duplicates", () => {
    expect(
      mergeRelayUrls(
        ["wss://relay.damus.io", "wss://relay.nostr.band"],
        ["wss://relay.nostr.band", "wss://relay.example.com"],
      ),
    ).toEqual([
      "wss://relay.damus.io",
      "wss://relay.nostr.band",
      "wss://relay.example.com",
    ]);
  });
});
