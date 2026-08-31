/**
 * نطاق الرؤية — المكافئ لسياسات RLS، مطبَّقاً في طبقة الـ API.
 *
 * النطاق بعدان مستقلّان، لا عمود واحد:
 *
 *   الدور (role)      — ماذا يستطيع أن يفعل؟
 *     ADMIN      : يقرأ ويكتب ويدير حسابات الكادر.
 *     SUPERVISOR : يقرأ ويسجّل الحضور والتسميع، بلا إدارة حسابات ولا
 *                  إدارة سجلّات طلاب (CRUD).
 *     TEACHER    : حلقاته المسندة إليه (teacher_halaqat) والحلقات التي هو
 *                  أستاذها الأساسي (halaqat.teacher_id)، وطلاب تلك الحلقات.
 *
 *   القسم (department) — على مَن يفعله؟ (للإداريين وحدهم)
 *     NULL  ⇒ المعهد كامل — المدير العام.
 *     قيمة  ⇒ حلقات ذلك القسم وطلابها وتقاريره — مدير القسم.
 *
 * ولهذا لا يوجد دور SUPER_ADMIN: لو كان القسم دوراً لتضاعفت الأدوار مع
 * كل قسم جديد (ADMIN×3، SUPERVISOR×3…)، ولوجب تعديل كل
 * requireRole("ADMIN") في المشروع وإلا فقد المدير العام صلاحياته.
 * بالفصل يبقى فحص الصلاحية كما هو، ويُضاف قيد النطاق هنا وحده.
 *
 * ── نقطة الطيّ ───────────────────────────────────────────────────────
 * قيد القسم مطويّ داخل accessibleHalaqaIds. كل ما يستهلكها —
 * halaqaFilter و applyScope و assertHalaqaAccess و assertStudentAccess —
 * يصير مقسوماً تلقائياً. فلا يُضاف شرط department يدوياً في المسارات:
 * شرطٌ منسيّ في مسار واحد ثغرةُ تسريب، والطيّ يمنع نسيانه أصلاً.
 *
 * القاعدة: أي مسار يقرأ أو يكتب بيانات حلقة/طالب يجب أن يمرّ من هنا.
 */
import { db } from "../db/index.js";
import { ApiError } from "../lib/http.js";
import type { AuthUser, Department } from "../middleware/auth.js";

export function isAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPERVISOR";
}

/** إدارة حسابات الكادر — المدير وحده، لا المشرف. */
export function canManageUsers(user: AuthUser): boolean {
  return user.role === "ADMIN";
}

/** مدير عام: إداريّ بلا قسم — يرى المعهد كاملاً. */
export function isSuperAdmin(user: AuthUser): boolean {
  return isAdmin(user) && user.department === null;
}

/**
 * قسم المستخدم إن كان نطاقه محصوراً به، وإلا `null`.
 *
 * تُعيد null للمدرّس أيضاً وإن كان له عمود قسم: نطاقه حلقاته المسندة لا
 * قسمه، وإضافة قيد القسم فوق ذلك تحجب عنه حلقة أُسندت إليه من قسم آخر
 * (المدرّس المشترك بين قسمين حالة واقعية، لا شذوذ بيانات).
 */
export function departmentScope(user: AuthUser): Department | null {
  return isAdmin(user) ? user.department : null;
}

/**
 * هل يقع القسم المطلوب داخل نطاق المستخدم؟
 *
 * حلقة بلا قسم (`null`، أي سابقة للترقية 012 ولم تُسنَد بعد) لا يراها إلا
 * المدير العام. البديل — أن تظهر لكل الأقسام — تسريبٌ صامت، وإخفاؤها عن
 * مدير القسم عَرَضٌ ظاهر يُصحَّح بإسناد الحلقة.
 */
export function canAccessDepartment(user: AuthUser, dept: Department | null): boolean {
  const scope = departmentScope(user);
  return scope === null || scope === dept;
}

/** يرمي 403 إذا كان القسم خارج نطاق المستخدم. */
export function assertDepartmentAccess(user: AuthUser, dept: Department | null): void {
  if (!canAccessDepartment(user, dept)) {
    throw ApiError.forbidden("هذا القسم خارج نطاق صلاحياتك");
  }
}

/**
 * قيد SQL على عمود قسم مباشر (halaqat.department أو users.department).
 * يعيد `null` لمن لا قيد عليه.
 *
 * للاستعمال حيث لا يوجد halaqa_id يُفلتَر عليه — أبرزه قائمة الكادر في
 * /api/users: مدير القسم يرى كادر قسمه وحده.
 */
export function departmentFilter(
  user: AuthUser,
  column: string
): { sql: string; params: string[] } | null {
  const scope = departmentScope(user);
  if (scope === null) return null;
  return { sql: `${column} = ?`, params: [scope] };
}

/** يضيف قيد القسم إلى مصفوفتَي الشروط والمعاملات إن لزم. */
export function applyDepartmentScope(
  user: AuthUser,
  column: string,
  where: string[],
  params: unknown[]
): void {
  const filter = departmentFilter(user, column);
  if (!filter) return;
  where.push(filter.sql);
  params.push(...filter.params);
}

/**
 * معرّفات الحلقات التي يصل إليها المستخدم، أو `null` بمعنى "بلا قيد".
 *
 * ثلاث حالات:
 *   مدير عام  ⇒ null   (المعهد كامل)
 *   مدير قسم  ⇒ حلقات قسمه
 *   مدرّس     ⇒ حلقاته المسندة إليه
 */
export async function accessibleHalaqaIds(user: AuthUser): Promise<number[] | null> {
  if (isAdmin(user)) {
    const scope = departmentScope(user);
    if (scope === null) return null;

    const rows = await db().all<{ id: number }>(
      "SELECT id FROM halaqat WHERE department = ?",
      [scope]
    );
    return rows.map((r) => r.id);
  }

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
  // null = بلا قيد (مدير عام). مدير القسم يُفحص بقائمة حلقات قسمه كالمدرّس
  const ids = await accessibleHalaqaIds(user);
  if (ids === null) return true;
  if (halaqaId === null) return false;
  return ids.includes(halaqaId);
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
  // المدير العام وحده يتخطّى الفحص؛ مدير القسم يمرّ منه كالمدرّس
  if (isSuperAdmin(user)) return;

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
 * شرط SQL يقصر النتائج على نطاق المستخدم عبر عمود halaqa_id.
 * يعيد `null` للمدير العام وحده (بلا قيد)، وإلا جملة جاهزة مع معاملاتها.
 *
 * قيد القسم مشمول ضمناً — راجع "نقطة الطيّ" في رأس الملف.
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

  // لا حلقات في النطاق (مدرّس بلا إسناد، أو قسم لم تُسنَد إليه حلقة بعد):
  // لا نتائج، بدل كشف كل شيء
  if (ids.length === 0) return { sql: "1 = 0", params: [] };

  return {
    sql: `${column} IN (${ids.map(() => "?").join(", ")})`,
    params: ids,
  };
}

/**
 * شرط SQL يقصر النتائج على نطاق المستخدم عبر عمود يشير إلى `students.id`.
 *
 * لجداول لا تحمل halaqa_id بنفسها — أبرزها awqaf_records: انتماء السجلّ
 * إلى قسمٍ يمرّ بالطالب، فالحلقة صفةُ الطالب لا صفةُ السبر.
 *
 * الشرط استعلام فرعي لا JOIN: الوصل يغيّر شكل `FROM` في كل استعلام
 * ويكسر `COUNT(*)` إن تكرّرت الصفوف، والاستعلام الفرعي يُلحق بـ WHERE
 * وحده — فيبقى الاستعلام الأصلي كما هو حين لا قيد.
 */
export async function studentFilter(
  user: AuthUser,
  column: string
): Promise<{ sql: string; params: number[] } | null> {
  const ids = await accessibleHalaqaIds(user);
  if (ids === null) return null;
  if (ids.length === 0) return { sql: "1 = 0", params: [] };

  return {
    sql: `${column} IN (SELECT id FROM students
                        WHERE halaqa_id IN (${ids.map(() => "?").join(", ")}))`,
    params: ids,
  };
}

/** نظير applyScope لعمود student_id. */
export async function applyStudentScope(
  user: AuthUser,
  column: string,
  where: string[],
  params: unknown[]
): Promise<void> {
  const filter = await studentFilter(user, column);
  if (!filter) return;
  where.push(filter.sql);
  params.push(...filter.params);
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
