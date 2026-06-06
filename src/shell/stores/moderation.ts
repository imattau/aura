const BLOCKED_PUBKEYS_KEY = "aura_blocked_pubkeys";

function loadBlockedPubkeys(): string[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(BLOCKED_PUBKEYS_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function saveBlockedPubkeys(pubkeys: string[]): void {
  localStorage.setItem(BLOCKED_PUBKEYS_KEY, JSON.stringify(pubkeys));
}

export function listBlockedPubkeys(): string[] {
  return loadBlockedPubkeys();
}

export function isPubkeyBlocked(pubkey: string): boolean {
  return loadBlockedPubkeys().includes(pubkey);
}

export function blockPubkey(pubkey: string): void {
  const normalized = pubkey.trim();
  if (!normalized) return;

  const next = loadBlockedPubkeys();
  if (!next.includes(normalized)) {
    next.unshift(normalized);
    saveBlockedPubkeys(next);
  }
}

export function unblockPubkey(pubkey: string): void {
  const normalized = pubkey.trim();
  if (!normalized) return;

  const next = loadBlockedPubkeys().filter((value) => value !== normalized);
  saveBlockedPubkeys(next);
}
