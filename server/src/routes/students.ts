import { Router } from "express";
import { z } from "zod";
import { db, tx } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam, isoDate, pagination } from "../lib/schemas.js";
import { requireRole } from "../middleware/auth.js";
import { deleteAvatar, saveAvatar } from "../lib/avatars.js";
import { addPoints } from "../services/points.js";
import { applyScope, assertHalaqaAccess, assertStudentAccess } from "../services/scope.js";

export const studentsRouter = Router();

const SELECT_STUDENT = `
  SELECT s.id,
         s.code,
         s.name,
         s.halaqa_id                AS halaqaId,
         COALESCE(h.name, '')       AS halaqa,
         s.birth_date               AS birthDate,
         s.student_phone            AS studentPhone,
         s.parent_phone             AS parentPhone,
         s.avatar_url               AS avatarUrl,
         s.points,
         s.is_active                AS isActive,
         s.created_at               AS createdAt
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

function nextStudentCode(): string {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM students WHERE code LIKE ?")
    .get(`${year}%`) as { n: number };
  return `${year}${String(row.n + 1).padStart(3, "0")}`;
}

/** GET /api/students?halaqaId=&search= — قائمة الطلاب (شكل صفحة كل الطلاب). */
studentsRouter.get(
  "/",
  asyncHandler((req, res) => {
    const q = parse(
      pagination.extend({
        halaqaId: z.coerce.number().int().positive().optional(),
        search: z.string().trim().min(1).optional(),
        active: z.coerce.boolean().default(true),
      }),
      req.query
    );

    const where: string[] = [];
    const params: unknown[] = [];
    if (q.active) where.push("s.is_active = 1");
    if (q.halaqaId) {
      where.push("s.halaqa_id = ?");
      params.push(q.halaqaId);
    }
    if (q.search) {
      where.push("(s.name LIKE ? OR s.code LIKE ?)");
      params.push(`%${q.search}%`, `%${q.search}%`);
    }

    // المدرّس لا يرى إلا طلاب حلقاته — هذا ما يغذّي نافذة النقاط السريعة
    applyScope(req.user!, "s.halaqa_id", where, params);

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = (
      db.prepare(`SELECT COUNT(*) AS n FROM students s ${clause}`).get(...params) as { n: number }
    ).n;

    const data = db
      .prepare(`${SELECT_STUDENT} ${clause} ORDER BY s.name LIMIT ? OFFSET ?`)
      .all(...params, q.limit, q.offset);

    res.json({ data, meta: { total, limit: q.limit, offset: q.offset } });
  })
);

/** GET /api/students/:id — ملف الطالب مع ملخّص إحصائي. */
studentsRouter.get(
  "/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertStudentAccess(req.user!, id);

    const student = db.prepare(`${SELECT_STUDENT} WHERE s.id = ?`).get(id);
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const attendance = db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS attended
         FROM attendance_entries WHERE student_id = ?`
      )
      .get(id) as { total: number; attended: number | null };

    const recitations = db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN rating = 'excellent' THEN 1 ELSE 0 END) AS excellent,
                MAX(recited_at) AS lastDate
         FROM recitations WHERE student_id = ?`
      )
      .get(id) as { total: number; excellent: number | null; lastDate: string | null };

    res.json({
      data: student,
      stats: {
        attendance: {
          sessions: attendance.total,
          attended: attendance.attended ?? 0,
          rate: attendance.total
            ? Math.round(((attendance.attended ?? 0) / attendance.total) * 100)
            : 0,
        },
        recitations: {
          total: recitations.total,
          excellent: recitations.excellent ?? 0,
          lastDate: recitations.lastDate,
        },
      },
    });
  })
);

/** POST /api/students — إضافة طالب: المدير والمشرف. */
studentsRouter.post(
  "/",
  requireRole("ADMIN", "SUPERVISOR"),
  asyncHandler((req, res) => {
    const body = parse(studentBody, req.body);
    assertHalaqaAccess(req.user!, body.halaqa_id ?? null);
    const code = body.code ?? nextStudentCode();

    const info = db
      .prepare(
        `INSERT INTO students (code, name, halaqa_id, birth_date, student_phone, parent_phone, avatar_url)
         VALUES (@code, @name, @halaqa_id, @birth_date, @student_phone, @parent_phone, @avatar_url)`
      )
      .run({
        code,
        name: body.name,
        halaqa_id: body.halaqa_id ?? null,
        birth_date: body.birth_date ?? null,
        student_phone: body.student_phone ?? null,
        parent_phone: body.parent_phone ?? null,
        avatar_url: body.avatar_url ?? null,
      });

    res
      .status(201)
      .json({ data: db.prepare(`${SELECT_STUDENT} WHERE s.id = ?`).get(info.lastInsertRowid) });
  })
);

/** PATCH /api/students/:id — تعديل بيانات الطالب: المدير والمشرف. */
studentsRouter.patch(
  "/:id",
  requireRole("ADMIN", "SUPERVISOR"),
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertStudentAccess(req.user!, id);

    const body = parse(
      studentBody.partial().extend({ is_active: z.boolean().optional() }),
      req.body
    );

    // نقل الطالب إلى حلقة أخرى يتطلب صلاحية على الحلقة الهدف أيضاً
    if (body.halaqa_id !== undefined) {
      assertHalaqaAccess(req.user!, body.halaqa_id);
    }

    const current = db.prepare("SELECT * FROM students WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!current) throw ApiError.notFound("الطالب غير موجود");

    db.prepare(
      `UPDATE students SET
         name = @name, code = @code, halaqa_id = @halaqa_id, birth_date = @birth_date,
         student_phone = @student_phone, parent_phone = @parent_phone,
         avatar_url = @avatar_url, is_active = @is_active
       WHERE id = @id`
    ).run({
      id,
      name: body.name ?? current.name,
      code: body.code ?? current.code,
      halaqa_id: body.halaqa_id !== undefined ? body.halaqa_id : current.halaqa_id,
      birth_date: body.birth_date !== undefined ? body.birth_date : current.birth_date,
      student_phone:
        body.student_phone !== undefined ? body.student_phone : current.student_phone,
      parent_phone: body.parent_phone !== undefined ? body.parent_phone : current.parent_phone,
      avatar_url: body.avatar_url !== undefined ? body.avatar_url : current.avatar_url,
      is_active: body.is_active !== undefined ? Number(body.is_active) : current.is_active,
    });

    res.json({ data: db.prepare(`${SELECT_STUDENT} WHERE s.id = ?`).get(id) });
  })
);

/**
 * DELETE /api/students/:id — تعطيل، أو حذف نهائي عبر ?hard=true.
 * الحذف بنوعيه للمدير والمشرف؛ المدرّس يطّلع على طلاب حلقته فقط.
 */
studentsRouter.delete(
  "/:id",
  requireRole("ADMIN", "SUPERVISOR"),
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertStudentAccess(req.user!, id);
    const hard = req.query.hard === "true";

    const info = hard
      ? db.prepare("DELETE FROM students WHERE id = ?").run(id)
      : db.prepare("UPDATE students SET is_active = 0 WHERE id = ?").run(id);

    if (info.changes === 0) throw ApiError.notFound("الطالب غير موجود");
    res.status(204).end();
  })
);

/* ==================== النقاط ==================== */

/** GET /api/students/:id/points — سجل حركات النقاط. */
studentsRouter.get(
  "/:id/points",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertStudentAccess(req.user!, id);

    const q = parse(pagination, req.query);

    const student = db.prepare("SELECT points FROM students WHERE id = ?").get(id) as
      | { points: number }
      | undefined;
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const data = db
      .prepare(
        `SELECT p.id, p.delta, p.reason, p.kind, p.reference_id AS referenceId,
                p.created_at AS createdAt, COALESCE(u.name, '') AS createdBy
         FROM point_transactions p
         LEFT JOIN users u ON u.id = p.created_by
         WHERE p.student_id = ?
         ORDER BY p.id DESC LIMIT ? OFFSET ?`
      )
      .all(id, q.limit, q.offset);

    res.json({ data, meta: { balance: student.points } });
  })
);

/**
 * POST /api/students/:id/points
 * amount موجب للإضافة وسالب للخصم، أو استخدم operation: "add" | "deduct".
 */
studentsRouter.post(
  "/:id/points",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertStudentAccess(req.user!, id);

    const body = parse(
      z.object({
        amount: z.number().int().refine((n) => n !== 0, "المقدار لا يمكن أن يكون صفراً"),
        operation: z.enum(["add", "deduct"]).optional(),
        reason: z.string().max(300).optional(),
      }),
      req.body
    );

    const student = db.prepare("SELECT id, points FROM students WHERE id = ?").get(id) as
      | { id: number; points: number }
      | undefined;
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const magnitude = Math.abs(body.amount);
    const delta = body.operation === "deduct" ? -magnitude : body.operation === "add" ? magnitude : body.amount;

    if (student.points + delta < 0) {
      throw ApiError.badRequest("لا يمكن أن يصبح رصيد النقاط سالباً");
    }

    const txId = tx(() =>
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
function avatarOf(id: number): string | null {
  const row = db.prepare("SELECT avatar_url AS url FROM students WHERE id = ?").get(id) as
    | { url: string | null }
    | undefined;
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
  requireRole("ADMIN", "SUPERVISOR"),
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const { data } = parse(z.object({ data: z.string().min(1) }), req.body);

    const previous = avatarOf(id);
    const url = saveAvatar(data);

    db.prepare("UPDATE students SET avatar_url = ? WHERE id = ?").run(url, id);
    // بعد نجاح التحديث لا قبله: لو فشل الحفظ بقيت الصورة القديمة سليمة
    deleteAvatar(previous);

    res.status(201).json({ data: db.prepare(`${SELECT_STUDENT} WHERE s.id = ?`).get(id) });
  })
);

/** DELETE /api/students/:id/avatar — إزالة الصورة والعودة إلى الحرفين الأولين. */
studentsRouter.delete(
  "/:id/avatar",
  requireRole("ADMIN", "SUPERVISOR"),
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const previous = avatarOf(id);

    db.prepare("UPDATE students SET avatar_url = NULL WHERE id = ?").run(id);
    deleteAvatar(previous);

    res.json({ data: db.prepare(`${SELECT_STUDENT} WHERE s.id = ?`).get(id) });
  })
);

/** POST /api/students/:id/transfer — نقل الطالب إلى حلقة أخرى. */
studentsRouter.post(
  "/:id/transfer",
  requireRole("ADMIN", "SUPERVISOR"),
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const { halaqa_id } = parse(z.object({ halaqa_id: z.number().int().positive() }), req.body);

    const info = db.prepare("UPDATE students SET halaqa_id = ? WHERE id = ?").run(halaqa_id, id);
    if (info.changes === 0) throw ApiError.notFound("الطالب غير موجود");

    res.json({ data: db.prepare(`${SELECT_STUDENT} WHERE s.id = ?`).get(id) });
  })
);
