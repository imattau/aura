const STORAGE_KEY = "aura_petnames";

type PetnameMap = Record<string, string>;

function load(): PetnameMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as PetnameMap;
  } catch {
    return {};
  }
}

function save(map: PetnameMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function registerPetname(name: string, npub: string): void {
  const map = load();
  if (name in map) return;
  map[name] = npub;
  save(map);
}

export function resolveNpub(name: string): string | null {
  return load()[name] ?? null;
}

export function renamePetname(oldName: string, newName: string): void {
  const map = load();
  if (!(oldName in map)) return;
  map[newName] = map[oldName];
  delete map[oldName];
  save(map);
}

export function listPetnames(): { name: string; npub: string }[] {
  return Object.entries(load()).map(([name, npub]) => ({ name, npub }));
}
