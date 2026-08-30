import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { config } from "./config.js";
import { ApiError, errorHandler } from "./lib/http.js";
import { requireAuth } from "./middleware/auth.js";
import { attendanceRouter } from "./routes/attendance.js";
import { awqafRouter } from "./routes/awqaf.js";
import { authRouter } from "./routes/auth.js";
import { halaqatRouter } from "./routes/halaqat.js";
import { recitationsRouter } from "./routes/recitations.js";
import { reportsRouter } from "./routes/reports.js";
import { statisticsRouter } from "./routes/statistics.js";
import { studentsRouter } from "./routes/students.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  // الصور تُرسَل كـ data URL داخل JSON. الحدّ 3mb ليتّسع لصورة 2mb بعد
  // ترميز base64 (يزيد الحجم ~33%)، فيصل الطلب إلى فحصنا ويحصل المستخدم
  // على رسالة عربية واضحة بدل خطأ 413 خام من express.
  app.use(express.json({ limit: "3mb" }));
  app.use(morgan(config.isProd ? "combined" : "dev"));

  /**
   * صور الطلاب. تُقدَّم بلا مصادقة لأن <img> لا يرسل ترويسة Authorization؛
   * الحماية باسم ملف عشوائي غير قابل للتخمين. immutable لأن كل رفع
   * ينشئ اسماً جديداً فلا تُحدَّث الملفات في مكانها.
   */
  app.use(
    "/api/uploads",
    express.static(config.uploadsDir, {
      immutable: true,
      maxAge: "30d",
      index: false,
      dotfiles: "ignore",
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);

  // كل ما دون ذلك يتطلب تسجيل دخول
  app.use("/api/users", requireAuth, usersRouter);
  app.use("/api/halaqat", requireAuth, halaqatRouter);
  app.use("/api/students", requireAuth, studentsRouter);
  app.use("/api/attendance", requireAuth, attendanceRouter);
  app.use("/api/recitations", requireAuth, recitationsRouter);
  app.use("/api/reports", requireAuth, reportsRouter);
  app.use("/api/awqaf", requireAuth, awqafRouter);
  app.use("/api/statistics", requireAuth, statisticsRouter);

  // أي مسار تحت /api لم تلتقطه المسارات أعلاه = 404 بصيغة JSON.
  // يجب أن يسبق تقديم الواجهة، وإلا ابتلع fallback الـ SPA طلبات الـ API
  // فأعادت index.html (أو 405 على طلب POST إلى ملف ثابت).
  app.use("/api", (req, _res, next) => {
    next(ApiError.notFound(`المسار غير موجود: ${req.method} ${req.originalUrl}`));
  });

  serveWebApp(app);

  app.use((req, _res, next) => {
    next(ApiError.notFound(`المسار غير موجود: ${req.method} ${req.path}`));
  });

  app.use(errorHandler);

  return app;
}

/**
 * تقديم بناء الواجهة (Vite) من الخادم نفسه — نشر بخدمة واحدة على Railway.
 *
 * ملفات الأصول (assets/) تحمل بصمة محتوى في اسمها فتُخزَّن مؤدّبة إلى الأبد،
 * أمّا index.html فبلا تخزين حتى لا يعلق المتصفّح على نسخة قديمة تشير إلى
 * أصول حُذفت. كل مسار غير معروف يُعاد له index.html ليتولّاه React Router —
 * وهذا سبب استبعاد /api أعلاه.
 */
function serveWebApp(app: express.Express): void {
  // المسار المشتقّ من موقع الملف أولاً، ثم dist نسبة إلى مجلّد التشغيل —
  // منصّات مثل Railway قد تشغّل الخادم من جذر المستودع لا من مجلّد server.
  const candidates = [config.webDir, path.join(process.cwd(), "dist")];
  const webDir = candidates.find((dir) => fs.existsSync(path.join(dir, "index.html")));

  if (!webDir) {
    console.warn(
      `⚠ لم يُعثر على بناء الواجهة في ${candidates.join(" أو ")} — سيقدَّم الـ API وحده.`
    );
    console.warn("  شغّل: npm run build (من جذر المستودع) أو اضبط WEB_DIR.");
    return;
  }

  const indexFile = path.join(webDir, "index.html");

  app.use(
    express.static(webDir, {
      index: false,
      maxAge: "1y",
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
      },
    })
  );

  // GET/HEAD فقط: طلب POST إلى مسار غير موجود يجب أن يبقى 404 لا صفحة HTML.
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexFile);
  });
}
