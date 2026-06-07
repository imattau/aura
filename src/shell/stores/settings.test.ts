import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSettings,
  getSettingsState,
  setRelaySubscriptionMode,
} from "./settings";

describe("settings store", () => {
  beforeEach(() => {
    localStorage.clear();
    clearSettings();
  });

  it("defaults to global relay subscriptions", () => {
    expect(getSettingsState()).toEqual({
      relaySubscriptionMode: "global",
    });
  });

  it("persists relay subscription mode", () => {
    setRelaySubscriptionMode("following");

    expect(getSettingsState()).toEqual({
      relaySubscriptionMode: "following",
    });
    expect(localStorage.getItem("aura_settings")).toContain("following");
  });
});
