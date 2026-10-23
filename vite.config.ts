import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "src/client",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve("src/client/index.html"),
        schedule: resolve("src/client/schedule/index.html"),
      },
    },
  },
});
