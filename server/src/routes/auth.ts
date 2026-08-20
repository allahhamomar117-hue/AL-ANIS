import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { verifyPassword } from "../lib/password.js";
import { accessibleHalaqaIds } from "../services/scope.js";

export const authRouter = Router();

const phoneSchema = z.object({
  phone_number: z.string().min(6).max(20),
  country_code: z.string().min(1).max(5).default("963"),
});

const OTP_TTL_MINUTES = 10;

/**
 * توحيد اسم المستخدم قبل المقارنة: تُقصّ الأطراف، وتُجمع كل المسافات
 * (بما فيها المسافة العربية والتاب) في مسافة واحدة، ويُوحَّد حرف اللاتيني.
 * هكذا يدخل "عمار  شهوري" و" عمار شهوري " كما يدخل "عمار شهوري".
 */
function normalizeUsername(value: string): string {
  return value.replace(/[\s\u00a0\u200e\u200f\u2066-\u2069]+/g, " ").trim().toLowerCase();
}

/** يبحث عن المستخدم بالمطابقة التامة أولاً، ثم بالمقارنة الموحَّدة. */
function findUserByUsername(username: string) {
  type Row = { id: number; username: string | null; password_hash: string | null };

  const exact = db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ? AND is_active = 1")
    .get(username.trim()) as Row | undefined;
  if (exact) return exact;

  // الجدول صغير (حسابات كادر)، فالمسح هنا أرخص من دوال SQL نصية معقّدة
  const target = normalizeUsername(username);
  const rows = db
    .prepare("SELECT id, username, password_hash FROM users WHERE is_active = 1")
    .all() as Row[];

  return rows.find((row) => row.username && normalizeUsername(row.username) === target);
}


/** يبني كائن المستخدم المُعاد للواجهة: الدور والحلقة المرتبطة به. */
function publicUser(id: number) {
  const user = db
    .prepare(
      `SELECT u.id, u.name, u.username, u.phone_number, u.country_code, u.role
       FROM users u WHERE u.id = ?`
    )
    .get(id) as
    | {
        id: number;
        name: string;
        username: string | null;
        phone_number: string | null;
        country_code: string;
        role: "ADMIN" | "SUPERVISOR" | "TEACHER";
      }
    | undefined;

  if (!user) throw ApiError.notFound("المستخدم غير موجود");

  // حلقات المدرّس؛ للمشرف تبقى فارغة لأنه يرى الكل
  const halaqaIds = accessibleHalaqaIds({ id: user.id, name: user.name, role: user.role }) ?? [];

  const halaqat = halaqaIds.length
    ? (db
        .prepare(
          `SELECT id, name FROM halaqat WHERE id IN (${halaqaIds.map(() => "?").join(", ")})
           ORDER BY name`
        )
        .all(...halaqaIds) as { id: number; name: string }[])
    : [];

  return {
    ...user,
    /** الحلقة الافتراضية للمدرّس — عليها تُفتح الصفحات مباشرة. */
    halaqa_id: halaqat[0]?.id ?? null,
    halaqa_name: halaqat[0]?.name ?? null,
    halaqat,
  };
}

/**
 * POST /api/auth/login
 * تسجيل الدخول باسم المستخدم وكلمة المرور.
 */
authRouter.post(
  "/login",
  asyncHandler((req, res) => {
    const body = parse(
      z.object({
        username: z.string().trim().min(1, "اسم المستخدم مطلوب"),
        password: z.string().min(1, "كلمة المرور مطلوبة"),
        fcm_token: z.string().optional(),
      }),
      req.body
    );

    try {
      const row = findUserByUsername(body.username);

      if (!row) {
        // نسجّل السبب الحقيقي في الطرفية، ونُعيد للمستخدم رسالة عامة
        console.warn(`[auth/login] لا يوجد مستخدم فعّال باسم "${body.username}"`);
        throw ApiError.unauthorized("اسم المستخدم أو كلمة المرور غير صحيحة");
      }

      if (!row.password_hash) {
        console.warn(
          `[auth/login] المستخدم "${body.username}" (id=${row.id}) بلا كلمة مرور — ` +
            "شغّل npm run db:seed أو عيّن كلمة مرور له"
        );
        throw ApiError.unauthorized("هذا الحساب بلا كلمة مرور. راجع المشرف.");
      }

      if (!verifyPassword(body.password, row.password_hash)) {
        console.warn(`[auth/login] كلمة مرور خاطئة للمستخدم "${body.username}"`);
        throw ApiError.unauthorized("اسم المستخدم أو كلمة المرور غير صحيحة");
      }

      if (body.fcm_token) {
        db.prepare("UPDATE users SET fcm_token = ? WHERE id = ?").run(body.fcm_token, row.id);
      }

      const user = publicUser(row.id);
      console.log(`[auth/login] دخول ناجح: "${user.username ?? user.name}" (${user.role})`);

      res.json({ token: signToken({ id: row.id }), user });
    } catch (error) {
      // أخطاء المصادقة تمرّ كما هي؛ ما عداها يُسجَّل بتفاصيله
      if (error instanceof ApiError) throw error;

      const message = error instanceof Error ? error.message : String(error);
      console.error("[auth/login] فشل غير متوقع:", {
        username: body.username,
        error: message,
        code: (error as { code?: string }).code,
      });
      if (error instanceof Error && error.stack) console.error(error.stack);

      // السبب الأشيع: قاعدة بيانات لم تُطبَّق عليها ترقية أسماء المستخدمين
      if (/no such column: (username|password_hash)/i.test(message)) {
        throw new ApiError(
          500,
          "قاعدة البيانات تحتاج ترقية: أوقف الخادم ثم شغّل npm run db:migrate",
          message
        );
      }
      if (/no such table/i.test(message)) {
        throw new ApiError(
          500,
          "جداول قاعدة البيانات ناقصة: شغّل npm run db:migrate ثم npm run db:seed",
          message
        );
      }

      throw new ApiError(500, "تعذّر تسجيل الدخول", message);
    }
  })
);

/**
 * POST /api/auth/request-otp
 * يُنشئ رمز تحقق للرقم. في التطوير يُرجع الرمز في الاستجابة.
 */
authRouter.post(
  "/request-otp",
  asyncHandler((req, res) => {
    const { phone_number, country_code } = parse(phoneSchema, req.body);

    const user = db
      .prepare(
        "SELECT id FROM users WHERE country_code = ? AND phone_number = ? AND is_active = 1"
      )
      .get(country_code, phone_number) as { id: number } | undefined;

    if (!user) throw ApiError.notFound("هذا الرقم غير مسجّل");

    const code = config.isProd
      ? String(Math.floor(100000 + Math.random() * 900000))
      : config.devOtp;

    db.prepare(
      `INSERT INTO otp_codes (country_code, phone_number, code, expires_at)
       VALUES (?, ?, ?, datetime('now', '+${OTP_TTL_MINUTES} minutes'))`
    ).run(country_code, phone_number, code);

    // TODO: إرسال الرمز عبر مزوّد SMS في بيئة الإنتاج.
    res.json({
      message: "تم إرسال رمز التحقق",
      expires_in_minutes: OTP_TTL_MINUTES,
      ...(config.isProd ? {} : { dev_code: code }),
    });
  })
);

/**
 * POST /api/auth/verify-otp
 * يتحقق من الرمز ويُصدر رمز دخول (JWT).
 */
authRouter.post(
  "/verify-otp",
  asyncHandler((req, res) => {
    const body = parse(
      phoneSchema.extend({
        otp: z.string().min(4).max(8),
        fcm_token: z.string().optional(),
      }),
      req.body
    );

    const record = db
      .prepare(
        `SELECT id FROM otp_codes
         WHERE country_code = ? AND phone_number = ? AND code = ?
           AND consumed_at IS NULL AND expires_at > datetime('now')
         ORDER BY id DESC LIMIT 1`
      )
      .get(body.country_code, body.phone_number, body.otp) as { id: number } | undefined;

    if (!record) throw ApiError.badRequest("رمز التحقق غير صحيح أو منتهي الصلاحية");

    db.prepare("UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?").run(
      record.id
    );

    const user = db
      .prepare(
        `SELECT id, name, phone_number, country_code, role
         FROM users WHERE country_code = ? AND phone_number = ? AND is_active = 1`
      )
      .get(body.country_code, body.phone_number) as
      | { id: number; name: string; phone_number: string; country_code: string; role: string }
      | undefined;

    if (!user) throw ApiError.notFound("المستخدم غير موجود");

    if (body.fcm_token) {
      db.prepare("UPDATE users SET fcm_token = ? WHERE id = ?").run(body.fcm_token, user.id);
    }

    res.json({ token: signToken(user), user: publicUser(user.id) });
  })
);

/** GET /api/auth/me — بيانات المستخدم الحالي. */
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user!.id) });
});
