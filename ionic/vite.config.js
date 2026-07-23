import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// The live site is served from https://mdefitko777.github.io/Gunpula/app/, so the
// production build has to resolve assets against that sub-path. Dev server runs at
// root for convenience.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Gunpula/app/" : "/",
  plugins: [vue()],
  server: { port: 5175 },
}));
