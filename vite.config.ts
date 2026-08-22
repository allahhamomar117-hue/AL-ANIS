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
        /**
         * حين لا يكون خادم الأنيس شغّالاً يردّ الوسيط بـ 500 فارغ، ويُطبع
         * ECONNREFUSED في طرفية Vite لا في طرفية الخادم — فيبدو الخطأ وكأنه
         * عطل في تسجيل الدخول. نستبدل به 503 برسالة تقول ما ينقص فعلاً.
         */
        configure(proxy) {
          proxy.on("error", (error, _req, res) => {
            const refused = (error as NodeJS.ErrnoException).code === "ECONNREFUSED";

            console.error(
              refused
                ? `
✖ خادم الأنيس غير شغّال على ${apiTarget}
  شغّله في طرفية أخرى: npm run api   (أو npm run dev:all لتشغيل الاثنين)
`
                : `
✖ خطأ في الوسيط نحو ${apiTarget}: ${error.message}
`
            );

            // res قد يكون Socket (على طلبات WebSocket) فلا يملك writeHead
            if (!("writeHead" in res) || res.headersSent) return;

            res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
            res.end(
              JSON.stringify({
                error: refused
                  ? `خادم الأنيس غير شغّال على ${apiTarget}. شغّل: npm run api`
                  : `تعذّر الاتصال بخادم الأنيس: ${error.message}`,
              })
            );
          });
        },
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
