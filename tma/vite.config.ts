import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    hmr: { host: "localhost", port: 5173 },
  },
  preview: { host: true, port: 5173 },
  // Prod bundle'dan console/debugger olib tashlanadi.
  esbuild: { drop: ["console", "debugger"] },
  build: {
    target: "es2020",
    cssMinify: true,
    reportCompressedSize: false,
    // Telegram WebView zamonaviy — legacy modulepreload polyfill shart emas.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: {
          // Framer-motion asosiy route'larda kam — alohida chunk.
          motion: ["framer-motion"],
          // Xarita faqat checkout'da — boshlang'ich bundle'ni shishirmasin.
          leaflet: ["leaflet"],
        },
      },
    },
  },
});
