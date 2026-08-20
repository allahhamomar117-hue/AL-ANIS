import cors from "cors";
import express from "express";
import morgan from "morgan";
import { config } from "./config.js";
import { ApiError, errorHandler } from "./lib/http.js";
import { requireAuth } from "./middleware/auth.js";
import { attendanceRouter } from "./routes/attendance.js";
import { authRouter } from "./routes/auth.js";
import { halaqatRouter } from "./routes/halaqat.js";
import { recitationsRouter } from "./routes/recitations.js";
import { reportsRouter } from "./routes/reports.js";
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

  app.use((req, _res, next) => {
    next(ApiError.notFound(`المسار غير موجود: ${req.method} ${req.path}`));
  });

  app.use(errorHandler);

  return app;
}
