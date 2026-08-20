import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// هدف الوسيط قابل للتهيئة: VITE_API_TARGET=http://localhost:4001 npm run dev
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // كل طلب يبدأ بـ /api يروح لخادم الأنيس المحلي
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      // كل طلب يبدأ بـ /lotties يروح للسيرفر الخارجي
      "/lotties": {
        target: "https://bayanmasters-store-back.bayanmasters.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lotties/, "/lotties"),
      },
    },
  },
});
