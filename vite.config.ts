import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // كل طلب يبدأ بـ /lotties يروح للسيرفر الخارجي
      "/lotties": {
        target: "https://bayanmasters-store-back.bayanmasters.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lotties/, "/lotties"),
      },
    },
  },
});
