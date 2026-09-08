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
   * قسم الإداري. `null` = المعهد كامل (المدير العام)، وقيمة = ذلك القسم
   * وحده (مدير القسم). لا معنى له للمدرّس — نطاقه حلقاته المسندة إليه.
   */
  department: Department | null;
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

  const user = await db().get<AuthUser>(
    "SELECT id, name, role, department FROM users WHERE id = ? AND is_active = TRUE",
    [Number(payload.sub)]
  );

  if (!user) return next(ApiError.unauthorized("المستخدم غير موجود"));

  // دور غير معروف (بيانات قديمة أو معدّلة يدوياً) يُعامل كأقلّ صلاحية
  // بدل أن ينهار أول فحص صلاحيات يعتمد عليه
  if (!ROLES.includes(user.role)) {
    console.warn(`[auth] دور غير معروف "${user.role}" للمستخدم ${user.id} — يُعامل كمدرّس`);
    user.role = "TEACHER";
  }

  /*
   * قسم غير معروف (بيانات قديمة أو معدّلة يدوياً) يُرفض الطلب لأجله.
   *
   * كان يُعامل كـ null بحجّة أن حجب كل شيء عن مدير يبدو عطلاً في النظام
   * لا في البيانات. والحجّة خاطئة، لأن `null` هنا ليست «بلا قسم» بل هي
   * نطاق المعهد كامل: أي انحرافٍ في نصّ القسم — حرفٌ زائد، أو اسم عربي
   * كُتب مكان المفتاح — كان يرقّي مدير القسم إلى مدير عام صامتاً. وهذا
   * فشلٌ مفتوح في عمود صلاحيات، وهو أسوأ ما يكون الفشل.
   *
   * والرفض يخصّ الإداريين وحدهم: نطاق المدرّس حلقاته المسندة لا قسمه
   * (departmentScope تُعيد له null على أي حال)، فقيمةٌ فاسدة في عموده لا
   * تمنحه شيئاً — وحجب الدخول عنه عقوبةٌ على انحراف لا أثر له.
   */
  if (user.department !== null && !DEPARTMENTS.includes(user.department)) {
    console.warn(
      `[auth] قسم غير معروف "${user.department}" للمستخدم ${user.id}`
    );
    if (user.role === "ADMIN" || user.role === "SUPERVISOR") {
      return next(
        ApiError.forbidden(
          "قسم الحساب غير صالح — راجع إدارة الكادر لتصحيحه قبل المتابعة"
        )
      );
    }
    user.department = null;
  }

  req.user = user;
  next();
});

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
  if (req.user.role !== "ADMIN" || req.user.department !== null) {
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
