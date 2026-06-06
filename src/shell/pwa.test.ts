import { afterEach, describe, expect, it, vi } from "vitest";
import { isStandaloneMode } from "./pwa";

describe("isStandaloneMode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when display-mode matches standalone", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: true }),
      navigator: {},
    });

    expect(isStandaloneMode()).toBe(true);
  });

  it("returns true when navigator.standalone is set", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: true },
    });

    expect(isStandaloneMode()).toBe(true);
  });

  it("returns false otherwise", () => {
    vi.stubGlobal("window", {
      matchMedia: () => ({ matches: false }),
      navigator: {},
    });

    expect(isStandaloneMode()).toBe(false);
  });
});
