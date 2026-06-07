import { beforeEach, describe, expect, it } from "vitest";
import { clearRecentSites, listRecentSites, recordRecentSite } from "./browser";

describe("browser store", () => {
  beforeEach(() => {
    clearRecentSites();
  });

  it("records recent sites with normalized paths", () => {
    recordRecentSite("npub1abc", "about.html", "Example");

    expect(listRecentSites()).toEqual([
      {
        npub: "npub1abc",
        siteName: null,
        path: "/about.html",
        label: "Example",
        description: null,
        visitedAt: expect.any(Number),
      },
    ]);
  });

  it("deduplicates sites by pubkey and path", () => {
    recordRecentSite("npub1abc", "/about.html", "Example");
    recordRecentSite("npub1abc", "/about.html", "Example 2");

    expect(listRecentSites()).toHaveLength(1);
    expect(listRecentSites()[0]?.label).toBe("Example 2");
  });

  it("distinguishes recent sites by site name", () => {
    recordRecentSite("npub1abc", "/index.html", "Alpha", null, "site-a");
    recordRecentSite("npub1abc", "/index.html", "Beta", null, "site-b");

    expect(listRecentSites()).toHaveLength(2);
    expect(listRecentSites()[0]?.siteName).toBe("site-b");
  });

  it("keeps the most recent entries first", () => {
    recordRecentSite("npub1aaa", "/index.html", "A");
    recordRecentSite("npub1bbb", "/index.html", "B");

    expect(listRecentSites().map((site) => site.npub)).toEqual([
      "npub1bbb",
      "npub1aaa",
    ]);
  });

  it("limits the number of recent sites", () => {
    for (let i = 0; i < 10; i += 1) {
      recordRecentSite(`npub1${i}`, "/index.html", `Site ${i}`);
    }

    expect(listRecentSites()).toHaveLength(8);
  });
});
