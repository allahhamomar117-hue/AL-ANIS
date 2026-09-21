import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { ApiError, asyncHandler } from "../lib/http.js";

export const ROLES = ["ADMIN", "SUPERVISOR", "TEACHER"] as const;
export type Role = (typeof ROLES)[number];

export const DEPARTMENTS = ["PRIMARY", "MIDDLE_HIGH", "INTENSIVE"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export interface AuthUser {
  id: number;
  name: string;
  role: Role;
  /**
   * أقسام الإداري (الجدول الوسيط user_departments).
   *
   * القائمة الفارغة = المعهد كامل (المدير العام)، وقسم فأكثر = تلك
   * الأقسام وحدها. لا معنى لها للمدرّس — نطاقه حلقاته المسندة إليه.
   *
   * مرتّبة دائماً بترتيب DEPARTMENTS: القائمة تُعرض للمستخدم وتدخل في
   * مقارنات، وترتيبٌ يتبع ما تصادف في القاعدة يجعل الشاشة تتبدّل بلا سبب.
   */
  departments: Department[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: number }): string {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

/** يتطلب رمز Bearer صالحاً ويحمّل المستخدم في req.user. */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized("رمز الدخول مفقود"));

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  } catch {
    return next(ApiError.unauthorized("رمز الدخول غير صالح أو منتهي"));
  }

  const row = await db().get<Omit<AuthUser, "departments">>(
    "SELECT id, name, role FROM users WHERE id = ? AND is_active = TRUE",
    [Number(payload.sub)]
  );

  if (!row) return next(ApiError.unauthorized("المستخدم غير موجود"));

  const user: AuthUser = { ...row, departments: await loadDepartments(row.id) };

  // دور غير معروف (بيانات قديمة أو معدّلة يدوياً) يُعامل كأقلّ صلاحية
  // بدل أن ينهار أول فحص صلاحيات يعتمد عليه
  if (!ROLES.includes(user.role)) {
    console.warn(`[auth] دور غير معروف "${user.role}" للمستخدم ${user.id} — يُعامل كمدرّس`);
    user.role = "TEACHER";
  }

  /*
   * قسم غير معروف (بيانات قديمة أو معدّلة يدوياً) يُرفض الطلب لأجله.
   *
   * لا يُسقَط صامتاً، لأن إسقاطه قد يُفرغ القائمة — والفارغة هنا ليست
   * «بلا قسم» بل نطاق المعهد كامل: أي انحرافٍ في نصّ القسم (حرفٌ زائد،
   * أو اسم عربي كُتب مكان المفتاح) كان يرقّي مدير القسم إلى مدير عام
   * صامتاً. وهذا فشلٌ مفتوح في صلاحية، وهو أسوأ ما يكون الفشل.
   *
   * والرفض يخصّ الإداريين وحدهم: نطاق المدرّس حلقاته المسندة لا أقسامه
   * (departmentScope تُعيد له null على أي حال)، فقيمةٌ فاسدة عنده لا
   * تمنحه شيئاً — وحجب الدخول عنه عقوبةٌ على انحراف لا أثر له.
   */
  const unknown = user.departments.filter((d) => !DEPARTMENTS.includes(d));
  if (unknown.length) {
    console.warn(`[auth] أقسام غير معروفة ${unknown.join("، ")} للمستخدم ${user.id}`);

    if (user.role === "ADMIN" || user.role === "SUPERVISOR") {
      return next(
        ApiError.forbidden(
          "قسم الحساب غير صالح — راجع إدارة الكادر لتصحيحه قبل المتابعة"
        )
      );
    }
    user.departments = [];
  }

  req.user = user;
  next();
});

/**
 * أقسام المستخدم من الجدول الوسيط، مرتَّبةً بترتيب DEPARTMENTS.
 *
 * الترتيب هنا لا في SQL: ترتيب القاعدة أبجديّ على النصّ فيعطي
 * INTENSIVE قبل PRIMARY، وترتيب DEPARTMENTS هو ترتيب المعهد المقصود —
 * وعليه تُعرض الرقاقات في الجدول، فلا تتبدّل مواضعها بين حسابٍ وآخر.
 */
export async function loadDepartments(userId: number): Promise<Department[]> {
  const rows = await db().all<{ department: Department }>(
    "SELECT department FROM user_departments WHERE user_id = ?",
    [userId]
  );

  const owned = new Set(rows.map((r) => r.department));
  const known = DEPARTMENTS.filter((d) => owned.has(d));

  // ما لا يعرفه DEPARTMENTS يُلحَق كما هو ليراه فحص الانحراف أعلاه
  const strange = [...owned].filter((d) => !DEPARTMENTS.includes(d));
  return [...known, ...strange];
}

/** يقصر الوصول على أدوار معيّنة. يُستخدم بعد requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("هذه العملية تتطلب صلاحية أعلى"));
    }
    next();
  };
}

/**
 * إدارة حسابات الكادر محصورة بالمدير (ADMIN) وحده.
 * المشرف يرى كل البيانات لكنه لا ينشئ حسابات ولا يغيّر الأدوار،
 * منعاً للتضارب في الصلاحيات.
 */
export const requireUserManager = requireRole("ADMIN");

/**
 * المدير العام وحده: دور ADMIN مع نطاق المعهد كامل (department = NULL).
 *
 * لا يُكتب بـ requireRole لأن القسم ليس دوراً — راجع «لا يوجد دور
 * SUPER_ADMIN» في services/scope.ts. وهو الحارس الوحيد في المشروع الذي
 * يقرأ البعد الثاني (النطاق) لا الأول (الدور)، فيُستعمل حيث يكون المورد
 * شأناً للمعهد كلّه لا لدورةٍ بعينها.
 *
 * ملاحظة: يأتي بعد requireAuth دائماً، وقد رفض ذاك أصلاً كل قسم غير
 * معروف للإداريين — فلا يصل إلى هنا حسابٌ نطاقه null بسبب انحراف بيانات.
 */
export function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== "ADMIN" || req.user.departments.length !== 0) {
    return next(ApiError.forbidden("هذه العملية للمدير العام وحده"));
  }
  next();
}

/** كل صلاحيات البيانات الموسّعة: المدير والمشرف سواء. */
export const requireStaff = requireRole("ADMIN", "SUPERVISOR");

/**
 * إدارة سجلّات الطلاب (إنشاء/تعديل/حذف/نقل/صورة) محصورة بالمدير وحده.
 * المشرف دوره تشغيلي يومي: يسمّع، ويأخذ الحضور، ويمنح النقاط ويخصمها،
 * ويعرض التقارير — ويقرأ قوائم الطلاب اللازمة لذلك، لكنه لا يمسّ
 * بيانات الطالب الأساسية.
 */
export const requireStudentManager = requireRole("ADMIN");

/**
 * الإحصاءات العامة ولوحة الصدارة: للمدير وللمدرّس (ضمن نطاق حلقاته).
 * المشرف محجوب عنها — دوره المتابعة اليومية لا الإحصاء العام.
 * لا تُكتب requireRole("ADMIN") هنا: المدرّس يحتاج لوحة صدارة حلقاته.
 */
export const denySupervisor = requireRole("ADMIN", "TEACHER");
