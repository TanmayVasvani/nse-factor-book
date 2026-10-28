import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative asset paths, so the built site works from any folder or sub-path
  // (Vercel, Netlify, GitHub Pages, or a plain static host).
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2022",
    sourcemap: false,
    // Recharts is the bulk of the bundle; one chunk is fine for a single static page.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
