import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["apple-touch-icon.png"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
      // Dev'da SW o'chirilgan: eski keshlangan bundle/API javoblari yangi
      // kodni "CORS xatosi"day ko'rsatib xato diagnostika qildirar edi.
      devOptions: { enabled: false, type: "module" },
      manifest: {
        name: "Barakali Bozor — Admin",
        short_name: "BB Admin",
        description: "Barakali Bozor do'kon boshqaruv paneli",
        lang: "uz",
        theme_color: "#16A34A",
        background_color: "#f1f5f9",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: { host: true, port: 3000 },
  preview: { host: true, port: 3000 },
});
