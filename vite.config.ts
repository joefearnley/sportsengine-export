import { defineConfig } from "vite";

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
  },
});
