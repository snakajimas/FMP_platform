import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `vite dev`, proxy /api to the local wrangler pages dev server
// so Functions (and server-side API keys) work in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
