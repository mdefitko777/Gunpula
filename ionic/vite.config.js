import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

// The live site is served from https://mdefitko777.github.io/Gunpula/app/, so the
// production build has to resolve assets against that sub-path. Dev server runs at
// root for convenience.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Gunpula/app/" : "/",
  plugins: [vue()],
  resolve: {
    alias: {
      // Reuse the framework-agnostic logic layer from the vanilla app as a single
      // source of truth (i18n, catalog-display, world-themes, collection-store…).
      "@app": fileURLToPath(new URL("../app", import.meta.url)),
    },
  },
  server: {
    port: 5175,
    // Allow importing modules that live outside ionic/ (the shared app/ layer).
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
}));
