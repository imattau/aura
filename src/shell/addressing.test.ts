import { describe, expect, it } from "vitest";
import { parseAuraAddress } from "./addressing";

describe("parseAuraAddress", () => {
  it("parses a named aura site address", () => {
    expect(
      parseAuraAddress("~npub1abc/my-site/index.html"),
    ).toEqual({
      npub: "npub1abc",
      siteName: "my-site",
      path: "/index.html",
    });
  });

  it("returns null for a plain npub", () => {
    expect(parseAuraAddress("npub1abc")).toBeNull();
  });
});
