import { describe, expect, it } from "vitest";
import {
  buildAuraSearchHash,
  buildAuraSiteHash,
  buildAuraSiteUrl,
  normalizeSitePath,
  readAuraRouteFromHash,
  readAuraSiteFromHash,
} from "./navigation";

describe("normalizeSitePath", () => {
  it("defaults to the index page", () => {
    expect(normalizeSitePath("")).toBe("/index.html");
  });

  it("preserves absolute paths", () => {
    expect(normalizeSitePath("/about.html")).toBe("/about.html");
  });

  it("adds a leading slash to relative paths", () => {
    expect(normalizeSitePath("about.html")).toBe("/about.html");
  });
});

describe("buildAuraSiteUrl", () => {
  it("builds a virtual Aura url", () => {
    expect(buildAuraSiteUrl("npub1abc", "about.html")).toBe(
      "/~npub1abc/about.html",
    );
  });
});

describe("buildAuraSiteHash", () => {
  it("builds a shell hash", () => {
    expect(buildAuraSiteHash("npub1abc", "about.html")).toBe(
      "#/~npub1abc/about.html",
    );
  });
});

describe("readAuraSiteFromHash", () => {
  it("parses an aura site hash", () => {
    expect(readAuraSiteFromHash("#/~npub1abc/about.html")).toEqual({
      npub: "npub1abc",
      path: "/about.html",
    });
  });

  it("returns null for unrelated hashes", () => {
    expect(readAuraSiteFromHash("#settings")).toBeNull();
  });
});

describe("readAuraRouteFromHash", () => {
  it("parses a search hash", () => {
    expect(readAuraRouteFromHash(buildAuraSearchHash("nostr aura"))).toEqual({
      kind: "search",
      query: "nostr aura",
    });
  });

  it("returns home for an unrelated hash", () => {
    expect(readAuraRouteFromHash("#settings")).toEqual({ kind: "home" });
  });
});
