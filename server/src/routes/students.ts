import { Router } from "express";
import { z } from "zod";
import { db, tx, type SqlParam } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam, isoDate, pagination } from "../lib/schemas.js";
import { requireStudentManager } from "../middleware/auth.js";
import { deleteAvatar, saveAvatar } from "../lib/avatars.js";
import {
  addPoints,
  DAILY_MANUAL_LIMITS,
  dailyManualTotals,
} from "../services/points.js";
import { applyScope, assertHalaqaAccess, assertStudentAccess } from "../services/scope.js";
import { existingStudent, STUDENT_STATUSES } from "../services/studentSql.js";

export const studentsRouter = Router();

const SELECT_STUDENT = `
  SELECT s.id,
         s.code,
         s.name,
         s.halaqa_id                AS "halaqaId",
         COALESCE(h.name, '')       AS halaqa,
         s.birth_date               AS "birthDate",
         s.student_phone            AS "studentPhone",
         s.parent_phone             AS "parentPhone",
         s.avatar_url               AS "avatarUrl",
         s.points,
         s.status,
         s.is_active                AS "isActive",
         s.created_at               AS "createdAt"
  FROM students s
  LEFT JOIN halaqat h ON h.id = s.halaqa_id
`;

const studentBody = z.object({
  name: z.string().min(2),
  code: z.string().min(1).max(20).optional(),
  halaqa_id: z.number().int().positive().nullable().optional(),
  birth_date: isoDate.nullable().optional(),
  student_phone: z.string().max(20).nullable().optional(),
  parent_phone: z.string().max(20).nullable().optional(),
  avatar_url: z
    .string()
    .refine((v) => v.startsWith("/api/uploads/") || /^https?:\/\//.test(v), "رابط صورة غير صالح")
    .nullable()
    .optional(),
});

async function nextStudentCode(): Promise<string> {
  const year = new Date().getFullYear();
  const row = await db().get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM students WHERE code LIKE ?",
    [`${year}%`]
  );
  return `${year}${String((row?.n ?? 0) + 1).padStart(3, "0")}`;
}

/** GET /api/students?halaqaId=&search= — قائمة الطلاب (شكل صفحة كل الطلاب). */
studentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = parse(
      pagination.extend({
        halaqaId: z.coerce.number().int().positive().optional(),
        search: z.string().trim().min(1).optional(),
        active: z.coerce.boolean().default(true),
        /**
         * طور الطالب: 'active' (الافتراضي) | 'archived' | 'all'.
         *
         * الافتراضي هو الجاري، فكل ما يستهلك هذه القائمة اليوم — نافذة
         * النقاط السريعة، اختيار الطالب في ترشيح الأوقاف، صفحة الطلاب —
         * يعمل على الدورة الجارية. إظهار المؤرشفين طلبٌ صريح لا سلوك
         * ضمنيّ.
         */
        status: z.enum(["active", "archived", "all"]).default("active"),
      }),
      req.query
    );

    const where: string[] = [];
    const params: SqlParam[] = [];
    // active يخصّ السجلّ (محذوف أو لا)، و status يخصّ طور الطالب
    if (q.active) where.push(existingStudent("s"));
    if (q.status !== "all") {
      where.push("s.status = ?");
      params.push(q.status);
    }
    if (q.halaqaId) {
      where.push("s.halaqa_id = ?");
      params.push(q.halaqaId);
    }
    if (q.search) {
      where.push("(s.name LIKE ? OR s.code LIKE ?)");
      params.push(`%${q.search}%`, `%${q.search}%`);
    }

    // المدرّس لا يرى إلا طلاب حلقاته — هذا ما يغذّي نافذة النقاط السريعة
    await applyScope(req.user!, "s.halaqa_id", where, params);

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const counted = await db().get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM students s ${clause}`,
      params
    );
    const total = counted?.n ?? 0;

    const data = await db().all(
      `${SELECT_STUDENT} ${clause} ORDER BY s.name LIMIT ? OFFSET ?`,
      [...params, q.limit, q.offset]
    );

    res.json({ data, meta: { total, limit: q.limit, offset: q.offset } });
  })
);

/** GET /api/students/:id — ملف الطالب مع ملخّص إحصائي. */
studentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertStudentAccess(req.user!, id);

    const student = await db().get(`${SELECT_STUDENT} WHERE s.id = ?`, [id]);
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const attendance = await db().get<{ total: number; attended: number | null }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS attended
       FROM attendance_entries WHERE student_id = ?`,
      [id]
    );

    const recitations = await db().get<{
      total: number;
      excellent: number | null;
      lastDate: string | null;
    }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN rating = 'excellent' THEN 1 ELSE 0 END) AS excellent,
              MAX(recited_at) AS "lastDate"
       FROM recitations WHERE student_id = ?`,
      [id]
    );

    const sessions = attendance?.total ?? 0;
    const attended = attendance?.attended ?? 0;

    res.json({
      data: student,
      stats: {
        attendance: {
          sessions,
          attended,
          rate: sessions ? Math.round((attended / sessions) * 100) : 0,
        },
        recitations: {
          total: recitations?.total ?? 0,
          excellent: recitations?.excellent ?? 0,
          lastDate: recitations?.lastDate ?? null,
        },
      },
    });
  })
);
/**
 * POST /api/students/bulk-transfer — نقل مجموعة طلاب إلى حلقة واحدة.
 *
 * مسجَّل قبل مسارات ‎/:id‎ كي لا يبتلعه ‎"bulk-transfer"‎ كأنه معرّف.
 * التحديث في معاملة واحدة: إمّا ينتقل الجميع أو لا أحد.
 */
studentsRouter.post(
  "/bulk-transfer",
  requireStudentManager,
  asyncHandler(async (req, res) => {
    const { studentIds, newHalaqaId } = parse(
      z.object({
        studentIds: z.array(z.number().int().positive()).min(1).max(500),
        newHalaqaId: z.number().int().positive(),
      }),
      req.body
    );

    const ids = [...new Set(studentIds)];

    const halaqa = await db().get<{ id: number }>("SELECT id FROM halaqat WHERE id = ?", [
      newHalaqaId,
    ]);
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const placeholders = ids.map(() => "?").join(", ");

    const moved = await tx(async () => {
      const found = await db().all<{ id: number }>(
        `SELECT id FROM students WHERE id IN (${placeholders})`,
        ids as SqlParam[]
      );
      if (found.length !== ids.length) throw ApiError.notFound("بعض الطلاب غير موجودين");

      await db().run(
        `UPDATE students SET halaqa_id = ? WHERE id IN (${placeholders})`,
        [newHalaqaId, ...ids] as SqlParam[]
      );

      return db().all(
        `${SELECT_STUDENT} WHERE s.id IN (${placeholders})`,
        ids as SqlParam[]
      );
    });

    res.json({ data: moved, meta: { moved: moved.length, halaqaId: newHalaqaId } });
  })
);


/** POST /api/students — إضافة طالب: المدير وحده. */
studentsRouter.post(
  "/",
  requireStudentManager,
  asyncHandler(async (req, res) => {
    const body = parse(studentBody, req.body);
    await assertHalaqaAccess(req.user!, body.halaqa_id ?? null);
    const code = body.code ?? (await nextStudentCode());

    const info = await db().run(
      `INSERT INTO students (code, name, halaqa_id, birth_date, student_phone, parent_phone, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        body.name,
        body.halaqa_id ?? null,
        body.birth_date ?? null,
        body.student_phone ?? null,
        body.parent_phone ?? null,
        body.avatar_url ?? null,
      ]
    );

    res.status(201).json({
      data: await db().get(`${SELECT_STUDENT} WHERE s.id = ?`, [info.lastInsertRowid]),
    });
  })
);

/** PATCH /api/students/:id — تعديل بيانات الطالب: المدير وحده. */
studentsRouter.patch(
  "/:id",
  requireStudentManager,
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertStudentAccess(req.user!, id);

    const body = parse(
      studentBody.partial().extend({ is_active: z.boolean().optional() }),
      req.body
    );

    // نقل الطالب إلى حلقة أخرى يتطلب صلاحية على الحلقة الهدف أيضاً
    if (body.halaqa_id !== undefined) {
      await assertHalaqaAccess(req.user!, body.halaqa_id);
    }

    const current = await db().get<Record<string, SqlParam>>(
      "SELECT * FROM students WHERE id = ?",
      [id]
    );
    if (!current) throw ApiError.notFound("الطالب غير موجود");

    await db().run(
      `UPDATE students SET
         name = ?, code = ?, halaqa_id = ?, birth_date = ?,
         student_phone = ?, parent_phone = ?,
         avatar_url = ?, is_active = ?
       WHERE id = ?`,
      [
        body.name ?? current.name,
        body.code ?? current.code,
        body.halaqa_id !== undefined ? body.halaqa_id : current.halaqa_id,
        body.birth_date !== undefined ? body.birth_date : current.birth_date,
        body.student_phone !== undefined ? body.student_phone : current.student_phone,
        body.parent_phone !== undefined ? body.parent_phone : current.parent_phone,
        body.avatar_url !== undefined ? body.avatar_url : current.avatar_url,
        // منطقيّ صريح: عمود Postgres من نوع boolean لا يقبل 0/1
        body.is_active !== undefined ? body.is_active : Boolean(current.is_active),
        id,
      ]
    );

    res.json({ data: await db().get(`${SELECT_STUDENT} WHERE s.id = ?`, [id]) });
  })
);

/**
 * DELETE /api/students/:id — تعطيل، أو حذف نهائي عبر ?hard=true.
 * الحذف بنوعيه للمدير وحده؛ المشرف والمدرّس يطّلعان فقط.
 */
studentsRouter.delete(
  "/:id",
  requireStudentManager,
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertStudentAccess(req.user!, id);
    const hard = req.query.hard === "true";

    const info = hard
      ? await db().run("DELETE FROM students WHERE id = ?", [id])
      : await db().run("UPDATE students SET is_active = FALSE WHERE id = ?", [id]);

    if (info.changes === 0) throw ApiError.notFound("الطالب غير موجود");
    res.status(204).end();
  })
);

/**
 * PATCH /api/students/:id/status — أرشفة الطالب أو إعادته إلى الدورة.
 *
 * مسار مستقلّ لا حقلٌ في PATCH العام: الأرشفة قرار إداري في دورة الطالب،
 * لا تعديلَ بيانات كالاسم والهاتف — وفصلها يمنع تغييرها عرضاً مع تعديل
 * روتيني، ويُبقيها محصورة بالمدير وحده.
 *
 * الاتجاهان في مسار واحد: الأرشفة وإلغاؤها عمليةٌ واحدة بقيمتين، وفتح
 * مسارين (archive/restore) يضاعف السطح بلا مقابل.
 *
 * لا تُمسّ أي سجلات: الحضور والتسميع والنقاط والأوقاف تبقى كما هي —
 * وهذا هو الغرض أصلاً، فالتاريخ محفوظ والطالب وحده يخرج من الشاشات.
 */
studentsRouter.patch(
  "/:id/status",
  requireStudentManager,
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertStudentAccess(req.user!, id);

    const { status } = parse(z.object({ status: z.enum(STUDENT_STATUSES) }), req.body);

    const info = await db().run("UPDATE students SET status = ? WHERE id = ?", [status, id]);
    if (info.changes === 0) throw ApiError.notFound("الطالب غير موجود");

    res.json({ data: await db().get(`${SELECT_STUDENT} WHERE s.id = ?`, [id]) });
  })
);

/* ==================== النقاط ==================== */

/** GET /api/students/:id/points — سجل حركات النقاط. */
studentsRouter.get(
  "/:id/points",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertStudentAccess(req.user!, id);

    const q = parse(pagination, req.query);

    const student = await db().get<{ points: number }>(
      "SELECT points FROM students WHERE id = ?",
      [id]
    );
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const data = await db().all(
      `SELECT p.id, p.delta, p.reason, p.kind, p.reference_id AS "referenceId",
              p.created_at AS "createdAt", COALESCE(u.name, '') AS "createdBy"
       FROM point_transactions p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.student_id = ?
       ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [id, q.limit, q.offset]
    );

    res.json({ data, meta: { balance: student.points } });
  })
);

/**
 * POST /api/students/:id/points
 * amount موجب للإضافة وسالب للخصم، أو استخدم operation: "add" | "deduct".
 */
studentsRouter.post(
  "/:id/points",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertStudentAccess(req.user!, id);

    const body = parse(
      z.object({
        amount: z.number().int().refine((n) => n !== 0, "المقدار لا يمكن أن يكون صفراً"),
        operation: z.enum(["add", "deduct"]).optional(),
        reason: z.string().max(300).optional(),
      }),
      req.body
    );

    const student = await db().get<{ id: number; points: number }>(
      "SELECT id, points FROM students WHERE id = ?",
      [id]
    );
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const magnitude = Math.abs(body.amount);
    const delta =
      body.operation === "deduct"
        ? -magnitude
        : body.operation === "add"
          ? magnitude
          : body.amount;

    if (student.points + delta < 0) {
      throw ApiError.badRequest("لا يمكن أن يصبح رصيد النقاط سالباً");
    }

    /*
     * حدّ يوميّ لكل (مستخدم، طالب) على النقاط اليدوية وحدها: المدير معفى،
     * أما الأستاذ والمشرف فلا يتجاوزان 25 إضافةً و10 خصماً في اليوم.
     * الإضافة والخصم يُحسبان منفصلين فلا يُرمَّم أحدهما بالآخر.
     */
    if (req.user!.role !== "ADMIN") {
      const totals = await dailyManualTotals(req.user!.id, id);
      const used = delta > 0 ? totals.added : totals.deducted;
      const limit = delta > 0 ? DAILY_MANUAL_LIMITS.add : DAILY_MANUAL_LIMITS.deduct;

      if (used + magnitude > limit) {
        const label = delta > 0 ? "إضافة" : "خصم";
        throw ApiError.badRequest(
          `تجاوزت حدّ ${label} النقاط اليومي لهذا الطالب (${limit} نقطة). ` +
            `سجّلت اليوم ${used} والمتبقّي ${Math.max(0, limit - used)}.`
        );
      }
    }

    const txId = await tx(() =>
      addPoints({
        studentId: id,
        delta,
        reason: body.reason,
        kind: "manual",
        createdBy: req.user!.id,
      })
    );

    res.status(201).json({
      data: { id: txId, delta, balance: student.points + delta },
    });
  })
);

/* ==================== الصورة الشخصية ==================== */

/** يقرأ الطالب أو يرمي 404. */
async function avatarOf(id: number): Promise<string | null> {
  const row = await db().get<{ url: string | null }>(
    "SELECT avatar_url AS url FROM students WHERE id = ?",
    [id]
  );
  if (!row) throw ApiError.notFound("الطالب غير موجود");
  return row.url;
}

/**
 * POST /api/students/:id/avatar — رفع صورة الطالب.
 * الجسم: { data: "data:image/jpeg;base64,…" }. الصورة تُصغَّر في المتصفح قبل
 * الإرسال، فالحمولة عادةً عشرات الكيلوبايتات لا ميغابايتات.
 */
studentsRouter.post(
  "/:id/avatar",
  requireStudentManager,
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { data } = parse(z.object({ data: z.string().min(1) }), req.body);

    const previous = await avatarOf(id);
    const url = saveAvatar(data);

    await db().run("UPDATE students SET avatar_url = ? WHERE id = ?", [url, id]);
    // بعد نجاح التحديث لا قبله: لو فشل الحفظ بقيت الصورة القديمة سليمة
    deleteAvatar(previous);

    res.status(201).json({ data: await db().get(`${SELECT_STUDENT} WHERE s.id = ?`, [id]) });
  })
);

/** DELETE /api/students/:id/avatar — إزالة الصورة والعودة إلى الحرفين الأولين. */
studentsRouter.delete(
  "/:id/avatar",
  requireStudentManager,
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const previous = await avatarOf(id);

    await db().run("UPDATE students SET avatar_url = NULL WHERE id = ?", [id]);
    deleteAvatar(previous);

    res.json({ data: await db().get(`${SELECT_STUDENT} WHERE s.id = ?`, [id]) });
  })
);

/** POST /api/students/:id/transfer — نقل الطالب إلى حلقة أخرى. */
studentsRouter.post(
  "/:id/transfer",
  requireStudentManager,
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { halaqa_id } = parse(z.object({ halaqa_id: z.number().int().positive() }), req.body);

    const info = await db().run("UPDATE students SET halaqa_id = ? WHERE id = ?", [
      halaqa_id,
      id,
    ]);
    if (info.changes === 0) throw ApiError.notFound("الطالب غير موجود");

    res.json({ data: await db().get(`${SELECT_STUDENT} WHERE s.id = ?`, [id]) });
  })
);
