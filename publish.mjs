#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { generateSecretKey, getPublicKey, finalizeEvent, nip19 } from 'nostr-tools';

const BLOSSOM = 'https://blossom.primal.net';
const RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];
const SHOWCASE_DIR = new URL('./public/aura-showcase/', import.meta.url).pathname;
const IDENTITY_FILE = new URL('./aura-identity.json', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
};

// --- Key resolution ---
let skBytes;
const envNsec = process.env.AURA_NSEC;
const nsecIdx = process.argv.indexOf('--nsec');
if (envNsec) {
  const decoded = nip19.decode(envNsec);
  if (decoded.type !== 'nsec') throw new Error('Invalid nsec in AURA_NSEC');
  skBytes = decoded.data;
  console.log('Using nsec from AURA_NSEC env var (not saved).');
} else if (nsecIdx !== -1) {
  const nsec = process.argv[nsecIdx + 1];
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
  skBytes = decoded.data;
  console.warn('Warning: --nsec flag exposes your key in /proc/*/cmdline. Prefer AURA_NSEC env var.');
  console.log('Using supplied nsec (not saved).');
} else if (existsSync(IDENTITY_FILE)) {
  const { skHex } = JSON.parse(readFileSync(IDENTITY_FILE, 'utf8'));
  skBytes = Buffer.from(skHex, 'hex');
  console.log('Loaded identity from aura-identity.json');
} else {
  skBytes = generateSecretKey();
  const skHex = Buffer.from(skBytes).toString('hex');
  writeFileSync(IDENTITY_FILE, JSON.stringify({ skHex }, null, 2), { mode: 0o600 });
  console.log('Generated new identity, saved to aura-identity.json');
}

const pubkey = getPublicKey(skBytes);
console.log('npub:', nip19.npubEncode(pubkey));

// --- Hash files ---
const dirents = readdirSync(SHOWCASE_DIR, { withFileTypes: true });
const files = {};
const fileData = {};
for (const dirent of dirents) {
  if (!dirent.isFile()) continue; // skip symlinks, directories, etc.
  const ext = extname(dirent.name);
  if (!MIME[ext]) continue; // only allow known safe extensions
  const path = join(SHOWCASE_DIR, dirent.name);
  const bytes = readFileSync(path);
  const hash = createHash('sha256').update(bytes).digest('hex');
  files[`/${dirent.name}`] = hash;
  fileData[`/${dirent.name}`] = { bytes, hash, mime: MIME[ext] };
}

// --- Build Blossom auth event (BUD-02 kind:24242) ---
function makeBlossomAuth(hash, mime, bytes) {
  const authEvent = finalizeEvent({
    kind: 24242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', 'upload'],
      ['x', hash],
      ['expiration', String(Math.floor(Date.now() / 1000) + 60)],
    ],
    content: 'Upload blob',
  }, skBytes);
  return 'Nostr ' + Buffer.from(JSON.stringify(authEvent)).toString('base64');
}

// --- Upload to Blossom ---
const MAX_ATTEMPTS = 3;

async function uploadAndVerify(urlPath, { bytes, hash, mime }) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Check if already present
    const headRes = await fetch(`${BLOSSOM}/${hash}`, { method: 'HEAD' });
    if (headRes.ok) {
      console.log(attempt === 1 ? `✓ already exists  ${urlPath}` : `✓ verified        ${urlPath} (attempt ${attempt})`);
      return;
    }

    // Upload
    const authHeader = makeBlossomAuth(hash, mime, bytes);
    const putRes = await fetch(`${BLOSSOM}/upload`, {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'Authorization': authHeader },
      body: bytes,
    });
    if (!putRes.ok) {
      const txt = await putRes.text().catch(() => '');
      throw new Error(`Upload failed for ${urlPath}: ${putRes.status} ${txt}`);
    }

    // Verify blob is accessible after upload
    const verifyRes = await fetch(`${BLOSSOM}/${hash}`, { method: 'HEAD' });
    if (verifyRes.ok) {
      console.log(`✓ uploaded        ${urlPath}`);
      return;
    }

    if (attempt < MAX_ATTEMPTS) {
      console.warn(`⚠ upload not yet visible for ${urlPath}, retrying (${attempt}/${MAX_ATTEMPTS})…`);
    } else {
      throw new Error(`Blob not accessible after ${MAX_ATTEMPTS} attempts: ${urlPath} (${hash})`);
    }
  }
}

for (const [urlPath, entry] of Object.entries(fileData)) {
  await uploadAndVerify(urlPath, entry);
}

// --- Build and sign kind:15128 event ---
const content = JSON.stringify({
  files,
  description: 'Aura is a Nostr-native web container. Publish complete websites using cryptographically verified blobs — no servers, no DNS.',
  icon: '/icon.svg',
  version: '1.0.0',
  start_path: '/index.html',
  theme_color: '#4f46e5',
});

const event = finalizeEvent({
  kind: 15128,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    ['t', 'aura-site'],
    ['name', 'aura-showcase'],
    ['description', 'Aura is a Nostr-native web container. Publish complete websites using cryptographically verified blobs — no servers, no DNS.'],
    ['icon', '/icon.svg'],
    ['version', '1.0.0'],
    ['start_path', '/index.html'],
    ['theme_color', '#4f46e5'],
  ],
  content,
}, skBytes);

console.log('\nPublishing event', event.id, 'to relays...');

// --- Publish to relays ---
let WS;
try {
  // Node >= 22 has global WebSocket
  WS = WebSocket;
} catch {
  WS = (await import('ws')).default;
}

async function publishToRelay(url) {
  return new Promise((resolve) => {
    const ws = new WS(url);
    const timer = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 8000);
    ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]));
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data[0] === 'OK' && data[1] === event.id) {
          clearTimeout(timer);
          ws.close();
          resolve(data[2] !== false);
        }
      } catch {}
    };
    ws.onerror = () => { clearTimeout(timer); resolve(false); };
  });
}

for (const relay of RELAYS) {
  const ok = await publishToRelay(relay);
  console.log(ok ? `✓ published  ${relay}` : `✗ failed     ${relay}`);
}

console.log('\nDone! npub:', nip19.npubEncode(pubkey));
