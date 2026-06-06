import { describe, expect, it } from "vitest";
import { matchAuraPath } from "./router";

describe("matchAuraPath", () => {
  it("matches a valid /~npub/path URL", () => {
    const result = matchAuraPath(
      "https://aura.example.com/~npub1abc123/blog/index.html",
    );
    expect(result).toEqual({ npub: "npub1abc123", path: "/blog/index.html" });
  });

  it("matches root path defaulting to /index.html", () => {
    const result = matchAuraPath("https://aura.example.com/~npub1abc123/");
    expect(result).toEqual({ npub: "npub1abc123", path: "/index.html" });
  });

  it("matches bare /~npub (no trailing slash) as /index.html", () => {
    const result = matchAuraPath("https://aura.example.com/~npub1abc123");
    expect(result).toEqual({ npub: "npub1abc123", path: "/index.html" });
  });

  it("returns null for non-aura paths", () => {
    expect(matchAuraPath("https://aura.example.com/assets/main.js")).toBeNull();
    expect(matchAuraPath("https://aura.example.com/")).toBeNull();
  });
});
