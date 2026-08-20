/**
 * نطاق الرؤية حسب الدور — المكافئ لسياسات RLS، مطبَّقاً في طبقة الـ API.
 *
 * ADMIN      : لا قيود (ويدير حسابات الكادر).
 * SUPERVISOR : لا قيود على البيانات، بلا إدارة حسابات.
 * TEACHER : الحلقات المسندة إليه فقط (teacher_halaqat) بالإضافة إلى الحلقات
 *           التي هو أستاذها الأساسي (halaqat.teacher_id)، وطلاب تلك الحلقات.
 *
 * القاعدة: أي مسار يقرأ أو يكتب بيانات حلقة/طالب يجب أن يمرّ من هنا.
 */
import { db } from "../db/index.js";
import { ApiError } from "../lib/http.js";
import type { AuthUser } from "../middleware/auth.js";

export function isAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPERVISOR";
}

/** إدارة حسابات الكادر — المدير وحده، لا المشرف. */
export function canManageUsers(user: AuthUser): boolean {
  return user.role === "ADMIN";
}

/** معرّفات الحلقات التي يصل إليها المستخدم. للمشرف تُعاد `null` بمعنى "الكل". */
export function accessibleHalaqaIds(user: AuthUser): number[] | null {
  if (isAdmin(user)) return null;

  const rows = db
    .prepare(
      `SELECT id FROM halaqat WHERE teacher_id = @userId
       UNION
       SELECT halaqa_id AS id FROM teacher_halaqat WHERE user_id = @userId`
    )
    .all({ userId: user.id }) as { id: number }[];

  return rows.map((r) => r.id);
}

export function canAccessHalaqa(user: AuthUser, halaqaId: number | null): boolean {
  if (isAdmin(user)) return true;
  if (halaqaId === null) return false;
  return accessibleHalaqaIds(user)!.includes(halaqaId);
}

/** يرمي 403 إذا كانت الحلقة خارج نطاق المستخدم. */
export function assertHalaqaAccess(user: AuthUser, halaqaId: number | null): void {
  if (!canAccessHalaqa(user, halaqaId)) {
    throw ApiError.forbidden("هذه الحلقة خارج نطاق صلاحياتك");
  }
}

/** يرمي 403 إذا كان الطالب خارج نطاق المستخدم (أو 404 إن لم يوجد). */
export function assertStudentAccess(user: AuthUser, studentId: number): void {
  if (isAdmin(user)) return;

  const student = db
    .prepare("SELECT halaqa_id AS halaqaId FROM students WHERE id = ?")
    .get(studentId) as { halaqaId: number | null } | undefined;

  if (!student) throw ApiError.notFound("الطالب غير موجود");
  assertHalaqaAccess(user, student.halaqaId);
}

/**
 * شرط SQL يقصر النتائج على نطاق المستخدم.
 * يعيد `null` للمشرف (بلا قيد)، وإلا جملة جاهزة مع معاملاتها.
 *
 * مثال: `const f = halaqaFilter(user, "s.halaqa_id");`
 *       `where.push(f.sql); params.push(...f.params);`
 */
export function halaqaFilter(
  user: AuthUser,
  column: string
): { sql: string; params: number[] } | null {
  const ids = accessibleHalaqaIds(user);
  if (ids === null) return null;

  // لا حلقات مسندة: لا نتائج (بدل كشف كل شيء)
  if (ids.length === 0) return { sql: "1 = 0", params: [] };

  return {
    sql: `${column} IN (${ids.map(() => "?").join(", ")})`,
    params: ids,
  };
}

/** يضيف قيد النطاق إلى مصفوفتَي الشروط والمعاملات إن لزم. */
export function applyScope(
  user: AuthUser,
  column: string,
  where: string[],
  params: unknown[]
): void {
  const filter = halaqaFilter(user, column);
  if (!filter) return;
  where.push(filter.sql);
  params.push(...filter.params);
}
