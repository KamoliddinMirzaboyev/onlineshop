/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Serverda: VITE_BASE=/courier/ npm run build
// Lokal/Vercel root: default /
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: { host: true, port: 3001 },
  preview: { host: true, port: 3001 },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
  },
});
