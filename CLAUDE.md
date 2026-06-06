# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aura** is a Nostr-based intranet/website container system. It enables hosting of complete web applications (multi-page sites with assets) using:

- **Nostr relays** for manifest distribution (content routing via `kind: 15128` NIP-5A manifest events mapping URL paths to SHA-256 blob hashes)
- **Blossom servers** for immutable, content-addressed blob storage (assets fetched by SHA-256 hash)
- **Service Workers** as the runtime engine in the browser — intercepting all navigation and asset requests, resolving them via the Nostr manifest, fetching blobs from Blossom, and constructing HTTP `Response` objects locally

The architecture requires no traditional web server infrastructure beyond a single static shell page that installs the Service Worker. All content assembly happens client-side.

## Key Architectural Concepts

- **Shell page**: A lightweight, static HTML/JS bootloader served from any host. Installs the Service Worker on first visit.
- **Service Worker**: Intercepts `FetchEvent`s, queries Nostr relays via WebSocket for the manifest, resolves paths to SHA-256 hashes, fetches blobs from Blossom, and returns synthetic `Response` objects to the browser.
- **Manifest event** (`kind: 15128`): JSON mapping of URL paths → SHA-256 blob hashes, published to Nostr relays by the site owner using their private key.
- **Blossom blobs**: Raw, immutable files stored by SHA-256 hash. Can be hosted on public storage — without the manifest mapping, blobs are unreadable and unlinkable.
- **Content integrity**: The Service Worker verifies blob hashes before execution; any tampered blob is rejected.
