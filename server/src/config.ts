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
  /**
   * رابط PostgreSQL‏ (Supabase). وجوده وحده يحوّل الخادم إلى Postgres،
   * وغيابه يُبقيه على ملف SQLite أعلاه — وهو ما يُبقي نسخة العرض تعمل
   * دون أي إعداد إضافي.
   */
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  /** مخطط Postgres — نسخة من schema.sql بأنواع Postgres. */
  schemaFilePg: path.join(here, "db", "schema.pg.sql"),
  /**
   * تصحيحات مخطط Postgres — تُطبَّق بعد المخطّط في كل إقلاع.
   *
   * ملفّ المخطّط كلّه `CREATE TABLE IF NOT EXISTS` فلا يلمس جدولاً قائماً،
   * فالقاعدة المُنشأة من إصدار أقدم تبقى على أنواعه. هنا تُصحَّح.
   */
  fixupsFilePg: path.join(here, "db", "fixups.pg.sql"),
  /** Supabase يفرض TLS. عطّله فقط لـ Postgres محلي بلا شهادة. */
  databaseSsl: process.env.DATABASE_SSL !== "false",
  /** حدّ اتصالات المجمّع. أبقِه صغيراً مع pooler الخاص بـ Supabase. */
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  /**
   * بناء الواجهة (Vite) الذي يقدّمه الخادم نفسه في الإنتاج — خدمة واحدة:
   * ‏/api للـ API وكل ما دونه للواجهة. الافتراضي مجلّد dist في جذر
   * المستودع (المجلّد الأب لـ server).
   */
  webDir: process.env.WEB_DIR
    ? path.resolve(serverRoot, process.env.WEB_DIR)
    : path.resolve(serverRoot, "..", "dist"),
  /** تشغيل بذرة العرض تلقائياً عند الإقلاع إن كانت القاعدة فارغة. */
  seedDemoOnStart: process.env.SEED_DEMO_ON_START === "true",
  /** يعيد بناء بيانات العرض في كل إقلاع (يمسح القاعدة). */
  seedDemoForce: process.env.SEED_DEMO_FORCE === "true",
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
   * نقاط التسميع مقدّرة لصفحة كاملة، وتُضرب بحجم المُسمَّع بالصفحات:
   * صفحة كاملة = ×1، أكثر من صفحة = عدد الصفحات، السورة = وزنها في
   * `surahs.ts` (كسر للسور القصيرة).
   */
  pointRules: {
    attendancePresent: Number(process.env.POINTS_ATTENDANCE ?? 10),
    /** لكل صفحة، بحسب التقييم. */
    recitation: {
      excellent: Number(process.env.POINTS_RECITATION_EXCELLENT ?? 30),
      good: Number(process.env.POINTS_RECITATION_GOOD ?? 25),
      needs: Number(process.env.POINTS_RECITATION_NEEDS ?? 20),
    },
    /**
     * حدّ أدنى لأي تسميع مقبول — يمنع الخروج بصفر بعد التقريب وحسب،
     * فالنقاط تبقى متناسبة مع حجم السورة كما هو مطلوب.
     */
    recitationMin: Number(process.env.POINTS_RECITATION_MIN ?? 1),
    /**
     * مكافأة النجاح في سبر الأوقاف — تُمنح مرّة واحدة لكل سجلّ سبر،
     * وتُسحب إن رُجع عن النتيجة (انظر routes/awqaf.ts).
     */
    awqafPassed: Number(process.env.POINTS_AWQAF_PASSED ?? 100),
  },
};
