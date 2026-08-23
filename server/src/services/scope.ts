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
export async function accessibleHalaqaIds(user: AuthUser): Promise<number[] | null> {
  if (isAdmin(user)) return null;

  // المعرّف يُمرَّر مرّتين لأن pg لا يدعم المعاملات المسمّاة
  const rows = await db().all<{ id: number }>(
    `SELECT id FROM halaqat WHERE teacher_id = ?
     UNION
     SELECT halaqa_id AS id FROM teacher_halaqat WHERE user_id = ?`,
    [user.id, user.id]
  );

  return rows.map((r) => r.id);
}

export async function canAccessHalaqa(
  user: AuthUser,
  halaqaId: number | null
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (halaqaId === null) return false;
  return (await accessibleHalaqaIds(user))!.includes(halaqaId);
}

/** يرمي 403 إذا كانت الحلقة خارج نطاق المستخدم. */
export async function assertHalaqaAccess(
  user: AuthUser,
  halaqaId: number | null
): Promise<void> {
  if (!(await canAccessHalaqa(user, halaqaId))) {
    throw ApiError.forbidden("هذه الحلقة خارج نطاق صلاحياتك");
  }
}

/** يرمي 403 إذا كان الطالب خارج نطاق المستخدم (أو 404 إن لم يوجد). */
export async function assertStudentAccess(
  user: AuthUser,
  studentId: number
): Promise<void> {
  if (isAdmin(user)) return;

  const student = await db().get<{ halaqaId: number | null }>(
    `SELECT halaqa_id AS "halaqaId" FROM students WHERE id = ?`,
    [studentId]
  );

  if (!student) throw ApiError.notFound("الطالب غير موجود");

  /*
   * طالب بلا حلقة (حُذفت حلقته أو نُقل ولم يُسنَد بعد) لا يقع في نطاق أي
   * مدرّس. الرسالة العامة كانت تقول "هذه الحلقة خارج نطاق صلاحياتك" فتُوهم
   * بوجود حلقة محجوبة، والحقيقة أنه غير مسنَد إلى واحدة — ففرّقناهما حتى
   * يعرف المدرّس أن العلاج إسناد الطالب لا طلب صلاحية.
   */
  if (student.halaqaId === null) {
    throw ApiError.forbidden("هذا الطالب غير مسنَد إلى أي حلقة — راجع إدارة المركز");
  }

  await assertHalaqaAccess(user, student.halaqaId);
}

/**
 * شرط SQL يقصر النتائج على نطاق المستخدم.
 * يعيد `null` للمشرف (بلا قيد)، وإلا جملة جاهزة مع معاملاتها.
 *
 * مثال: `const f = await halaqaFilter(user, "s.halaqa_id");`
 *       `where.push(f.sql); params.push(...f.params);`
 */
export async function halaqaFilter(
  user: AuthUser,
  column: string
): Promise<{ sql: string; params: number[] } | null> {
  const ids = await accessibleHalaqaIds(user);
  if (ids === null) return null;

  // لا حلقات مسندة: لا نتائج (بدل كشف كل شيء)
  if (ids.length === 0) return { sql: "1 = 0", params: [] };

  return {
    sql: `${column} IN (${ids.map(() => "?").join(", ")})`,
    params: ids,
  };
}

/** يضيف قيد النطاق إلى مصفوفتَي الشروط والمعاملات إن لزم. */
export async function applyScope(
  user: AuthUser,
  column: string,
  where: string[],
  params: unknown[]
): Promise<void> {
  const filter = await halaqaFilter(user, column);
  if (!filter) return;
  where.push(filter.sql);
  params.push(...filter.params);
}
