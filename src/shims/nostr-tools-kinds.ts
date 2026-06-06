export * from "nostr-tools/kinds";

export function isKind(kind: number): boolean {
  return Number.isInteger(kind) && kind >= 0;
}

export function isRegularKind(kind: number): boolean {
  return kind >= 1 && kind < 10000;
}

export function isReplaceableKind(kind: number): boolean {
  return kind >= 10000 && kind < 20000;
}

export function isEphemeralKind(kind: number): boolean {
  return kind >= 20000 && kind < 30000;
}

export function isAddressableKind(kind: number): boolean {
  return kind >= 30000 && kind < 40000;
}

export function isParameterizedReplaceableKind(kind: number): boolean {
  return isAddressableKind(kind);
}
