import MiniSearch from "minisearch";
import { type NostrEvent, nip19 } from "nostr-tools";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { isAuraManifestEvent, parseManifestMetadata } from "../sw/manifest";

const SQLITE_DB_NAME = "aura-sqlite-index";
const SQLITE_STORE_NAME = "snapshot";
const SQLITE_STORE_KEY = "db";

const RAW_EVENT_COLUMNS =
  "id, kind, pubkey, created_at, content, sig, tags_json";

type EventRow = {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  content: string;
  sig: string;
  tags_json: string;
};

export type CachedSearchResult = {
  id: string;
  kind: number;
  kindLabel: string;
  title: string;
  summary: string;
  pubkey: string;
  createdAt: number;
  resultKind: "site" | "article" | "note" | "user" | "other";
  path?: string;
  content: string;
  sig: string;
  tagsJson: string;
};

type SearchDocument = CachedSearchResult & {
  metadata: string;
};

let sqlModulePromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null =
  null;
let databasePromise: Promise<SqlJsDatabase | null> | null = null;
let persistPromise: Promise<void> = Promise.resolve();
let searchIndexPromise: Promise<SearchIndexState | null> | null = null;

type SearchIndexState = {
  index: MiniSearch<SearchDocument>;
  documents: Map<string, SearchDocument>;
};

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

async function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({
      locateFile: () => wasmUrl,
    });
  }

  return sqlModulePromise;
}

function openSnapshotDatabase(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SQLITE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(SQLITE_STORE_NAME)) return;
      database.createObjectStore(SQLITE_STORE_NAME, { keyPath: "key" });
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
      };
      resolve(database);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open Aura SQLite store."));
    };
  });
}

async function loadSnapshotBytes(): Promise<Uint8Array | null> {
  const database = await openSnapshotDatabase();
  if (!database) return null;

  return new Promise((resolve) => {
    const transaction = database.transaction(SQLITE_STORE_NAME, "readonly");
    const store = transaction.objectStore(SQLITE_STORE_NAME);
    const request = store.get(SQLITE_STORE_KEY);

    request.onsuccess = () => {
      const record = request.result as
        | { key: string; bytes?: Uint8Array }
        | undefined;
      resolve(record?.bytes ?? null);
    };

    request.onerror = () => resolve(null);
    transaction.onabort = () => resolve(null);
  });
}

async function saveSnapshotBytes(bytes: Uint8Array): Promise<void> {
  const database = await openSnapshotDatabase();
  if (!database) return;

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(SQLITE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SQLITE_STORE_NAME);
    store.put({
      key: SQLITE_STORE_KEY,
      bytes,
      savedAt: Date.now(),
    });
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => resolve();
    transaction.onerror = () => resolve();
  });
}

function createDatabase(SQL: Awaited<ReturnType<typeof initSqlJs>>) {
  return new SQL.Database();
}

function createSearchIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    idField: "id",
    autoVacuum: false,
    fields: ["title", "summary", "content", "metadata"],
    storeFields: [
      "kind",
      "kindLabel",
      "title",
      "summary",
      "pubkey",
      "createdAt",
      "resultKind",
      "path",
      "content",
      "sig",
      "tagsJson",
    ],
    searchOptions: {
      prefix: true,
    },
  });
}

function createSchema(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      kind INTEGER NOT NULL,
      pubkey TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      content TEXT NOT NULL,
      sig TEXT NOT NULL,
      tags_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_kind_created_at
      ON events(kind, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_events_pubkey_created_at
      ON events(pubkey, created_at DESC);

    CREATE TABLE IF NOT EXISTS profiles (
      pubkey TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT,
      about TEXT,
      picture TEXT,
      website TEXT,
      lud16 TEXT,
      nip05 TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      owner_pubkey TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_items (
      owner_pubkey TEXT NOT NULL,
      pubkey TEXT NOT NULL,
      petname TEXT,
      relay TEXT,
      PRIMARY KEY (owner_pubkey, pubkey)
    );

    CREATE TABLE IF NOT EXISTS relays (
      owner_pubkey TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS relay_items (
      owner_pubkey TEXT NOT NULL,
      relay_url TEXT NOT NULL,
      PRIMARY KEY (owner_pubkey, relay_url)
    );

    CREATE TABLE IF NOT EXISTS manifests (
      pubkey TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      name TEXT,
      description TEXT,
      icon TEXT,
      version TEXT,
      start_path TEXT NOT NULL,
      theme_color TEXT,
      files_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manifest_files (
      pubkey TEXT NOT NULL,
      path TEXT NOT NULL,
      hash TEXT NOT NULL,
      PRIMARY KEY (pubkey, path)
    );
  `);
}

function toStoredEvent(event: NostrEvent): EventRow {
  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    created_at: event.created_at,
    content: event.content,
    sig: event.sig,
    tags_json: JSON.stringify(event.tags ?? []),
  };
}

function bindValues(
  statement: ReturnType<SqlJsDatabase["prepare"]>,
  values: unknown[],
): void {
  statement.bind(values);
}

function runStatement(
  db: SqlJsDatabase,
  sql: string,
  values: unknown[] = [],
): void {
  const statement = db.prepare(sql);
  try {
    bindValues(statement, values);
    while (statement.step()) {
      // no-op
    }
  } finally {
    statement.free();
  }
}

function insertManifestFiles(
  db: SqlJsDatabase,
  pubkey: string,
  files: Record<string, string>,
): void {
  runStatement(db, "DELETE FROM manifest_files WHERE pubkey = ?", [pubkey]);
  for (const [path, hash] of Object.entries(files)) {
    runStatement(
      db,
      "INSERT OR REPLACE INTO manifest_files (pubkey, path, hash) VALUES (?, ?, ?)",
      [pubkey, path, hash],
    );
  }
}

function insertContactItems(
  db: SqlJsDatabase,
  ownerPubkey: string,
  event: NostrEvent,
): void {
  runStatement(db, "DELETE FROM contact_items WHERE owner_pubkey = ?", [
    ownerPubkey,
  ]);

  for (const tag of event.tags) {
    if (tag[0] !== "p" || typeof tag[1] !== "string") continue;
    const pubkey = tag[1].trim();
    if (!pubkey) continue;
    const petname = typeof tag[2] === "string" ? tag[2].trim() || null : null;
    const relay = typeof tag[3] === "string" ? tag[3].trim() || null : null;
    runStatement(
      db,
      "INSERT OR REPLACE INTO contact_items (owner_pubkey, pubkey, petname, relay) VALUES (?, ?, ?, ?)",
      [ownerPubkey, pubkey, petname, relay],
    );
  }
}

function insertRelayItems(
  db: SqlJsDatabase,
  ownerPubkey: string,
  event: NostrEvent,
): void {
  runStatement(db, "DELETE FROM relay_items WHERE owner_pubkey = ?", [
    ownerPubkey,
  ]);

  for (const tag of event.tags) {
    if (tag[0] !== "r" || typeof tag[1] !== "string") continue;
    const relayUrl = tag[1].trim();
    if (!relayUrl) continue;
    runStatement(
      db,
      "INSERT OR REPLACE INTO relay_items (owner_pubkey, relay_url) VALUES (?, ?)",
      [ownerPubkey, relayUrl],
    );
  }
}

function upsertDerivedTables(db: SqlJsDatabase, event: NostrEvent): void {
  if (event.kind === 0) {
    let parsed: {
      name?: unknown;
      about?: unknown;
      picture?: unknown;
      website?: unknown;
      lud16?: unknown;
      nip05?: unknown;
    } | null = null;

    try {
      parsed = JSON.parse(event.content) as typeof parsed;
    } catch {
      parsed = null;
    }

    runStatement(
      db,
      `
        INSERT OR REPLACE INTO profiles (
          pubkey, event_id, name, about, picture, website, lud16, nip05, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        event.pubkey,
        event.id,
        typeof parsed?.name === "string" ? parsed.name : null,
        typeof parsed?.about === "string" ? parsed.about : null,
        typeof parsed?.picture === "string" ? parsed.picture : null,
        typeof parsed?.website === "string" ? parsed.website : null,
        typeof parsed?.lud16 === "string" ? parsed.lud16 : null,
        typeof parsed?.nip05 === "string" ? parsed.nip05 : null,
        event.created_at,
      ],
    );
  }

  if (event.kind === 3) {
    runStatement(
      db,
      `
        INSERT OR REPLACE INTO contacts (owner_pubkey, event_id, created_at)
        VALUES (?, ?, ?)
      `,
      [event.pubkey, event.id, event.created_at],
    );
    insertContactItems(db, event.pubkey, event);
  }

  if (event.kind === 10002) {
    runStatement(
      db,
      `
        INSERT OR REPLACE INTO relays (owner_pubkey, event_id, created_at)
        VALUES (?, ?, ?)
      `,
      [event.pubkey, event.id, event.created_at],
    );
    insertRelayItems(db, event.pubkey, event);
  }

  if (event.kind === 15128) {
    if (!isAuraManifestEvent(event)) return;
    const manifest = parseManifestMetadata(event);
    runStatement(
      db,
      `
        INSERT OR REPLACE INTO manifests (
          pubkey, event_id, created_at, name, description, icon, version,
          start_path, theme_color, files_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        event.pubkey,
        event.id,
        event.created_at,
        manifest.name,
        manifest.description,
        manifest.icon,
        manifest.version,
        manifest.startPath,
        manifest.themeColor,
        JSON.stringify(manifest.files),
      ],
    );
    insertManifestFiles(db, event.pubkey, manifest.files);
  }
}

function insertEvents(db: SqlJsDatabase, events: NostrEvent[]): void {
  const statement = db.prepare(
    `
      INSERT OR REPLACE INTO events (
        id, kind, pubkey, created_at, content, sig, tags_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  );

  try {
    for (const event of events) {
      const stored = toStoredEvent(event);
      statement.bind([
        stored.id,
        stored.kind,
        stored.pubkey,
        stored.created_at,
        stored.content,
        stored.sig,
        stored.tags_json,
      ]);
      while (statement.step()) {
        // no-op
      }
      statement.reset();
      upsertDerivedTables(db, event);
    }
  } finally {
    statement.free();
  }
}

async function ensureDatabase(): Promise<SqlJsDatabase | null> {
  if (databasePromise) return databasePromise;

  databasePromise = (async () => {
    const SQL = await getSqlModule();
    const snapshot = await loadSnapshotBytes();
    const db = snapshot ? new SQL.Database(snapshot) : createDatabase(SQL);
    createSchema(db);
    return db;
  })().catch((caught) => {
    databasePromise = null;
    throw caught;
  });

  return databasePromise;
}

async function persistDatabase(db: SqlJsDatabase): Promise<void> {
  if (!hasIndexedDb()) return;
  const bytes = db.export();
  await saveSnapshotBytes(bytes);
}

function schedulePersist(db: SqlJsDatabase): void {
  persistPromise = persistPromise
    .then(() => persistDatabase(db))
    .catch(() => undefined);
}

function rowsToEvents(rows: EventRow[]): NostrEvent[] {
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    pubkey: row.pubkey,
    created_at: row.created_at,
    content: row.content,
    sig: row.sig,
    tags: JSON.parse(row.tags_json) as NostrEvent["tags"],
  }));
}

function queryRows(
  db: SqlJsDatabase,
  sql: string,
  values: unknown[] = [],
): EventRow[] {
  const statement = db.prepare(sql);
  try {
    bindValues(statement, values);
    const rows: EventRow[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as EventRow);
    }
    return rows;
  } finally {
    statement.free();
  }
}

function createPlaceholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

async function queryLatestRows(filter: {
  kinds: number[];
  authors?: string[];
  limit: number;
}): Promise<EventRow[]> {
  const db = await ensureDatabase();
  if (!db) return [];

  const values: unknown[] = [...filter.kinds];
  let where = `kind IN (${createPlaceholders(filter.kinds.length)})`;

  if (filter.authors && filter.authors.length > 0) {
    where += ` AND pubkey IN (${createPlaceholders(filter.authors.length)})`;
    values.push(...filter.authors);
  }

  values.push(filter.limit);
  return queryRows(
    db,
    `
      SELECT ${RAW_EVENT_COLUMNS}
      FROM events
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    values,
  );
}

async function queryLatestByKinds(filter: {
  kinds: number[];
  authors?: string[];
}): Promise<NostrEvent | null> {
  const rows = await queryLatestRows({ ...filter, limit: 1 });
  return rowsToEvents(rows)[0] ?? null;
}

function createSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .flatMap((part) => {
      if (!part) return [];
      return [part];
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: string, length: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= length) return compact;
  return `${compact.slice(0, length - 1).trimEnd()}…`;
}

function firstLine(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function summarizeContent(value: string, length: number): string {
  return shorten(value, length);
}

function makeSearchDocumentFromEvent(
  event: NostrEvent,
  data: {
    id: string;
    title: string;
    summary: string;
    kindLabel: string;
    resultKind: SearchDocument["resultKind"];
    path?: string;
    metadata: string;
  },
): SearchDocument {
  return {
    id: data.id,
    kind: event.kind,
    kindLabel: data.kindLabel,
    title: data.title,
    summary: data.summary,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    resultKind: data.resultKind,
    path: data.path,
    content: event.content,
    sig: event.sig,
    tagsJson: JSON.stringify(event.tags ?? []),
    metadata: data.metadata,
  };
}

function buildSearchDocument(event: NostrEvent): SearchDocument | null {
  if (event.kind === 15128) {
    if (!isAuraManifestEvent(event)) return null;
    const manifest = parseManifestMetadata(event);
    const title =
      manifest.name ??
      manifest.description ??
      shorten(firstLine(event.content), 64) ??
      nip19.npubEncode(event.pubkey);
    const summary =
      manifest.description ??
      summarizeContent(event.content, 180) ??
      "Aura site";

    return makeSearchDocumentFromEvent(event, {
      id: `site:${event.pubkey}`,
      title,
      summary,
      kindLabel: "Aura site",
      resultKind: "site",
      path: manifest.startPath,
      metadata: createSearchText([
        manifest.name,
        manifest.description,
        manifest.icon,
        manifest.version,
        manifest.startPath,
        manifest.themeColor,
        JSON.stringify(manifest.files),
      ]),
    });
  }

  if (event.kind === 30023) {
    const title = firstLine(event.content) || "Long-form article";
    const summary = summarizeContent(event.content, 220) || "Article";

    return makeSearchDocumentFromEvent(event, {
      id: `article:${event.id}`,
      title,
      summary,
      kindLabel: "Article",
      resultKind: "article",
      metadata: createSearchText([event.content, ...event.tags.flat()]),
    });
  }

  if (event.kind === 1) {
    const title = firstLine(event.content) || "Note";
    const summary = summarizeContent(event.content, 200) || "Note";

    return makeSearchDocumentFromEvent(event, {
      id: `note:${event.id}`,
      title,
      summary,
      kindLabel: "Note",
      resultKind: "note",
      metadata: createSearchText([event.content, ...event.tags.flat()]),
    });
  }

  if (event.kind === 0) {
    try {
      const parsed = JSON.parse(event.content) as {
        name?: unknown;
        about?: unknown;
        picture?: unknown;
        website?: unknown;
        lud16?: unknown;
        nip05?: unknown;
      };
      const title =
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name
          : nip19.npubEncode(event.pubkey);
      const summary =
        [parsed.about, parsed.website, parsed.nip05, parsed.lud16]
          .map((field) => (typeof field === "string" ? field.trim() : ""))
          .find(Boolean) ?? "Profile";

      return makeSearchDocumentFromEvent(event, {
        id: `user:${event.pubkey}`,
        title,
        summary,
        kindLabel: "User",
        resultKind: "user",
        metadata: createSearchText([
          typeof parsed.about === "string" ? parsed.about : null,
          typeof parsed.website === "string" ? parsed.website : null,
          typeof parsed.lud16 === "string" ? parsed.lud16 : null,
          typeof parsed.nip05 === "string" ? parsed.nip05 : null,
          typeof parsed.picture === "string" ? parsed.picture : null,
        ]),
      });
    } catch {
      return makeSearchDocumentFromEvent(event, {
        id: `user:${event.pubkey}`,
        title: nip19.npubEncode(event.pubkey),
        summary: "Profile",
        kindLabel: "User",
        resultKind: "user",
        metadata: "",
      });
    }
  }

  return null;
}

async function loadSearchDocuments(
  db: SqlJsDatabase,
): Promise<SearchDocument[]> {
  const documents = new Map<string, SearchDocument>();

  const manifestRows = queryRows(
    db,
    `
      SELECT
        e.id AS id,
        e.kind AS kind,
        e.pubkey AS pubkey,
        e.created_at AS created_at,
        e.content AS content,
        e.sig AS sig,
        e.tags_json AS tags_json,
        COALESCE(m.name, '') AS manifest_name,
        COALESCE(m.description, '') AS manifest_description,
        COALESCE(m.icon, '') AS manifest_icon,
        COALESCE(m.version, '') AS manifest_version,
        COALESCE(m.start_path, '') AS manifest_start_path,
        COALESCE(m.theme_color, '') AS manifest_theme_color,
        COALESCE(m.files_json, '') AS manifest_files_json
      FROM events e
      JOIN manifests m ON m.event_id = e.id
      ORDER BY e.created_at DESC
    `,
  ) as Array<
    EventRow & {
      manifest_name: string;
      manifest_description: string;
      manifest_icon: string;
      manifest_version: string;
      manifest_start_path: string;
      manifest_theme_color: string;
      manifest_files_json: string;
    }
  >;

  for (const row of manifestRows) {
    const event: NostrEvent = {
      id: row.id,
      kind: row.kind,
      pubkey: row.pubkey,
      created_at: row.created_at,
      content: row.content,
      sig: row.sig,
      tags: JSON.parse(row.tags_json) as NostrEvent["tags"],
    };
    const document = makeSearchDocumentFromEvent(event, {
      id: `site:${event.pubkey}`,
      title:
        row.manifest_name ||
        row.manifest_description ||
        shorten(firstLine(event.content), 64) ||
        nip19.npubEncode(event.pubkey),
      summary:
        row.manifest_description ||
        summarizeContent(event.content, 180) ||
        "Aura site",
      kindLabel: "Aura site",
      resultKind: "site",
      path: row.manifest_start_path || "/",
      metadata: createSearchText([
        row.manifest_name,
        row.manifest_description,
        row.manifest_icon,
        row.manifest_version,
        row.manifest_start_path,
        row.manifest_theme_color,
        row.manifest_files_json,
      ]),
    });
    documents.set(document.id, document);
  }

  const profileRows = queryRows(
    db,
    `
      SELECT
        e.id AS id,
        e.kind AS kind,
        e.pubkey AS pubkey,
        e.created_at AS created_at,
        e.content AS content,
        e.sig AS sig,
        e.tags_json AS tags_json,
        COALESCE(p.name, '') AS profile_name,
        COALESCE(p.about, '') AS profile_about,
        COALESCE(p.picture, '') AS profile_picture,
        COALESCE(p.website, '') AS profile_website,
        COALESCE(p.lud16, '') AS profile_lud16,
        COALESCE(p.nip05, '') AS profile_nip05
      FROM events e
      JOIN profiles p ON p.event_id = e.id
      ORDER BY e.created_at DESC
    `,
  ) as Array<
    EventRow & {
      profile_name: string;
      profile_about: string;
      profile_picture: string;
      profile_website: string;
      profile_lud16: string;
      profile_nip05: string;
    }
  >;

  for (const row of profileRows) {
    const event: NostrEvent = {
      id: row.id,
      kind: row.kind,
      pubkey: row.pubkey,
      created_at: row.created_at,
      content: row.content,
      sig: row.sig,
      tags: JSON.parse(row.tags_json) as NostrEvent["tags"],
    };
    const document = makeSearchDocumentFromEvent(event, {
      id: `user:${event.pubkey}`,
      title: row.profile_name || nip19.npubEncode(event.pubkey),
      summary:
        row.profile_about ||
        row.profile_website ||
        row.profile_nip05 ||
        row.profile_lud16 ||
        "Profile",
      kindLabel: "User",
      resultKind: "user",
      metadata: createSearchText([
        row.profile_about,
        row.profile_picture,
        row.profile_website,
        row.profile_lud16,
        row.profile_nip05,
      ]),
    });
    documents.set(document.id, document);
  }

  const contentRows = queryRows(
    db,
    `
      SELECT ${RAW_EVENT_COLUMNS}
      FROM events
      WHERE kind IN (1, 30023)
      ORDER BY created_at DESC
    `,
  );

  for (const row of contentRows) {
    const event: NostrEvent = {
      id: row.id,
      kind: row.kind,
      pubkey: row.pubkey,
      created_at: row.created_at,
      content: row.content,
      sig: row.sig,
      tags: JSON.parse(row.tags_json) as NostrEvent["tags"],
    };
    const document = buildSearchDocument(event);
    if (document) {
      documents.set(document.id, document);
    }
  }

  return [...documents.values()];
}

async function ensureSearchIndex(): Promise<SearchIndexState | null> {
  if (searchIndexPromise) return searchIndexPromise;

  searchIndexPromise = (async () => {
    const db = await ensureDatabase();
    if (!db) return null;

    const index = createSearchIndex();
    const documents = new Map<string, SearchDocument>();
    const sourceDocuments = await loadSearchDocuments(db);
    if (sourceDocuments.length > 0) {
      index.addAll(sourceDocuments);
      for (const document of sourceDocuments) {
        documents.set(document.id, document);
      }
    }

    return { index, documents };
  })().catch((caught) => {
    searchIndexPromise = null;
    throw caught;
  });

  return searchIndexPromise;
}

async function applySearchDocuments(events: NostrEvent[]): Promise<void> {
  const state = await ensureSearchIndex();
  if (!state) return;

  for (const event of events) {
    const document = buildSearchDocument(event);
    if (!document) continue;

    const existing = state.documents.get(document.id);
    if (existing) {
      state.index.remove(existing);
      state.index.add(document);
    } else {
      state.index.add(document);
    }
    state.documents.set(document.id, document);
  }
}

export async function putEvents(events: NostrEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await ensureDatabase();
  if (!db) return;

  insertEvents(db, events);
  await applySearchDocuments(events);
  schedulePersist(db);
}

export async function getLatestCachedEvent(options: {
  kinds: number[];
  authors?: string[];
}): Promise<NostrEvent | null> {
  return queryLatestByKinds(options);
}

export async function getRecentCachedEvents(options: {
  kinds: number[];
  authors?: string[];
  limit: number;
}): Promise<NostrEvent[]> {
  const rows = await queryLatestRows(options);
  return rowsToEvents(rows);
}

export async function searchCachedDocuments(
  query: string,
  limit = 64,
): Promise<SearchDocument[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const state = await ensureSearchIndex();
  if (!state) return [];

  const results = state.index.search(normalized, {
    prefix: true,
  });

  return results.slice(0, limit).map((result) => ({
    id: String(result.id),
    kind: result.kind,
    kindLabel: result.kindLabel,
    title: result.title,
    summary: result.summary,
    pubkey: result.pubkey,
    createdAt: result.createdAt,
    resultKind: result.resultKind,
    path: result.path,
    content: result.content,
    sig: result.sig,
    tagsJson: result.tagsJson,
  }));
}
