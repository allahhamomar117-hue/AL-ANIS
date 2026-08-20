import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbFile: process.env.DB_FILE
    ? path.resolve(serverRoot, process.env.DB_FILE)
    : path.join(serverRoot, "data", "anis.db"),
  schemaFile: path.join(here, "db", "schema.sql"),
  /** ملفات المستخدمين المرفوعة (صور الطلاب) بجوار ملف القاعدة. */
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(serverRoot, process.env.UPLOADS_DIR)
    : path.join(serverRoot, "data", "uploads"),
  jwtSecret: process.env.JWT_SECRET ?? "anis-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",
  /** في بيئة التطوير يُرجع رمز التحقق في الاستجابة بدل إرساله عبر SMS. */
  devOtp: process.env.DEV_OTP ?? "123456",
  isProd: process.env.NODE_ENV === "production",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  /**
   * نقاط تُمنح تلقائياً.
   *
   * نقاط التسميع لكل صفحة كاملة؛ ما دونها أو فوقها يُضرب بعدد الصفحات
   * (نصف صفحة = ×0.5، أكثر من صفحة = عدد الصفحات، السورة = وزنها في juzAmma).
   */
  pointRules: {
    attendancePresent: Number(process.env.POINTS_ATTENDANCE ?? 10),
    /** لكل صفحة، بحسب التقييم. */
    recitation: {
      excellent: Number(process.env.POINTS_RECITATION_EXCELLENT ?? 30),
      good: Number(process.env.POINTS_RECITATION_GOOD ?? 25),
      needs: Number(process.env.POINTS_RECITATION_NEEDS ?? 20),
    },
    /** حدّ أدنى لأي تسميع مقبول مهما صغر المقدار (سور قصيرة جداً). */
    recitationMin: Number(process.env.POINTS_RECITATION_MIN ?? 5),
  },
};
