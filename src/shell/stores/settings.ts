const STORAGE_KEY = "aura_settings";

export type RelaySubscriptionMode =
  | "global"
  | "following"
  | "global-following";

export interface SettingsState {
  relaySubscriptionMode: RelaySubscriptionMode;
}

const DEFAULT_SETTINGS: SettingsState = {
  relaySubscriptionMode: "global",
};

let state = load();

function load(): SettingsState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "{}",
    ) as Partial<SettingsState>;

    if (
      parsed.relaySubscriptionMode === "global" ||
      parsed.relaySubscriptionMode === "following" ||
      parsed.relaySubscriptionMode === "global-following"
    ) {
      return {
        relaySubscriptionMode: parsed.relaySubscriptionMode,
      };
    }
  } catch {
    // Ignore corrupt local storage and fall back to defaults.
  }

  return { ...DEFAULT_SETTINGS };
}

function save(nextState: SettingsState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export function getSettingsState(): SettingsState {
  return state;
}

export function setRelaySubscriptionMode(
  relaySubscriptionMode: RelaySubscriptionMode,
): void {
  state = { relaySubscriptionMode };
  save(state);
}

export function clearSettings(): void {
  state = { ...DEFAULT_SETTINGS };
  localStorage.removeItem(STORAGE_KEY);
}
