import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "favicon-16.png",
        "favicon-32.png",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icons.svg",
      ],
      manifest: {
        name: "TeamCanvas",
        short_name: "TeamCanvas",
        description: "팀 일정·협업을 하나의 캔버스에서",
        theme_color: "#3B8AD9",
        background_color: "#F0F7FF",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        importScripts: ["/push-handler.js"],
        navigateFallbackDenylist: [/^\/auth\//, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/organizations\/[^/]+\/(tasks|events)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-data-cache",
              expiration: { maxAgeSeconds: 86400, maxEntries: 32 },
            },
          },
          {
            urlPattern: /^\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxAgeSeconds: 3600 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8788", changeOrigin: true },
      "/auth": { target: "http://127.0.0.1:8788", changeOrigin: true },
    },
  },
});
