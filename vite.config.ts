import { resolve } from "node:path";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  server: {
    headers: {
      "Service-Worker-Allowed": "/",
    },
  },
  resolve: {
    alias: {
      "nostr-tools/kinds": resolve(__dirname, "src/shims/nostr-tools-kinds.ts"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        shell: resolve(__dirname, "index.html"),
        sw: resolve(__dirname, "src/sw/sw.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js",
      },
    },
  },
});
