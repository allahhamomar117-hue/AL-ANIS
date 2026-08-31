/**
 * شهادات وسبر الأوقاف — إدارة الطلاب المرشّحين لاختبارات وزارة الأوقاف
 * ونتائجهم فيها.
 *
 * الراوتر كلّه محصور بالمدير (requireStudentManager = ADMIN)، فلا حاجة
 * إلى قيد النطاق (scope) داخل الاستعلامات: المدير يرى كل الحلقات أصلاً.
 * الحصر مطبَّق على مستوى الراوتر لا على كل مسار، حتى لا يُنسى مع أي
 * مسار يُضاف لاحقاً.
 */
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { db, tx, type SqlParam } from "../db/index.js";
import { nowExpr } from "../db/sqlfn.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam } from "../lib/schemas.js";
import { requireStudentManager } from "../middleware/auth.js";
import { addPoints, revertPointsFor } from "../services/points.js";
import { visibleStudent } from "../services/studentSql.js";

export const awqafRouter = Router();

awqafRouter.use(requireStudentManager);

/** حالة الطالب في دورة السبر — مفاتيح ثابتة تُترجَم في الواجهة. */
const awqafStatus = z.enum(["nominated", "passed", "failed"]);

/** شهر السبر: YYYY-MM. لا يوم فيه — الدورة تُعرَّف بشهرها لا بتاريخ محدّد. */
const examMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "شهر السبر يجب أن يكون بصيغة YYYY-MM");

const SELECT_RECORD = `
  SELECT a.id,
         a.student_id                AS "studentId",
         s.name                      AS "studentName",
         s.code                      AS "studentCode",
         s.avatar_url                AS "studentAvatarUrl",
         s.halaqa_id                 AS "halaqaId",
         COALESCE(h.name, '')        AS halaqa,
         a.exam_month                AS "examMonth",
         a.status,
         a.notes,
         COALESCE(u.name, '')        AS "createdBy",
         a.created_at                AS "createdAt",
         a.updated_at                AS "updatedAt"
  FROM awqaf_records a
  JOIN students s ON s.id = a.student_id
  LEFT JOIN halaqat h ON h.id = s.halaqa_id
  LEFT JOIN users u ON u.id = a.created_by
`;

/**
 * GET /api/awqaf — السجلّات مع فلترة اختيارية بالشهر أو الحالة أو الحلقة.
 * الترتيب: الأحدث شهراً أولاً، ثم اسم الطالب داخل الشهر الواحد.
 */
awqafRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = parse(
      z.object({
        month: examMonth.optional(),
        status: awqafStatus.optional(),
        halaqaId: idParam.optional(),
      }),
      req.query
    );

    const where: string[] = [];
    const params: SqlParam[] = [];

    if (query.month) {
      where.push("a.exam_month = ?");
      params.push(query.month);
    }
    if (query.status) {
      where.push("a.status = ?");
      params.push(query.status);
    }
    if (query.halaqaId !== undefined) {
      where.push("s.halaqa_id = ?");
      params.push(query.halaqaId);
    }

    const sql = `${SELECT_RECORD}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.exam_month DESC, s.name`;

    const data = await db().all(sql, params);

    // الأشهر المسجَّلة كلها (لا أشهر الصفحة الحالية) — تغذّي قائمة الفلترة
    // فلا تختفي خيارات الأشهر الأخرى بمجرّد اختيار أحدها.
    const months = await db().all<{ month: string }>(
      `SELECT DISTINCT exam_month AS month FROM awqaf_records ORDER BY month DESC`
    );

    res.json({ data, meta: { months: months.map((m) => m.month) } });
  })
);

/** GET /api/awqaf/:id */
awqafRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const record = await db().get(`${SELECT_RECORD} WHERE a.id = ?`, [id]);
    if (!record) throw ApiError.notFound("السجل غير موجود");
    res.json({ data: record });
  })
);

/** POST /api/awqaf — ترشيح طالب لدورة سبر. */
awqafRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        studentId: z.number().int().positive(),
        examMonth,
        status: awqafStatus.default("nominated"),
        notes: z.string().max(500).nullable().optional(),
      }),
      req.body
    );

    // المؤرشف لا يُرشَّح لسبر جديد؛ سجلّاته السابقة تبقى كما هي
    const student = await db().get<{ id: number }>(
      `SELECT id FROM students WHERE id = ? AND ${visibleStudent("")}`,
      [body.studentId]
    );
    if (!student) throw ApiError.badRequest("الطالب غير موجود أو مؤرشف");

    // القاعدة تمنع التكرار بقيد UNIQUE، لكن رسالتها العامة ("السجل موجود
    // مسبقاً") لا تدلّ على السبب — نفحص أولاً لنردّ رسالة تشرح الحالة.
    const clash = await db().get<{ id: number }>(
      "SELECT id FROM awqaf_records WHERE student_id = ? AND exam_month = ?",
      [body.studentId, body.examMonth]
    );
    if (clash) throw ApiError.conflict("الطالب مرشّح في هذا الشهر مسبقاً");

    const recordId = await tx(async () => {
      const info = await db().run(
        `INSERT INTO awqaf_records (student_id, exam_month, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [body.studentId, body.examMonth, body.status, body.notes ?? null, req.user!.id]
      );

      // الترشيح يبدأ عادةً بـ nominated، لكن المسار يقبل status صراحةً —
      // فالسجلّ المُنشأ ناجحاً يمنح مكافأته هنا لا في تعديل لاحق.
      if (body.status === "passed") {
        await addPoints({
          studentId: body.studentId,
          delta: config.pointRules.awqafPassed,
          reason: `نجاح في سبر الأوقاف ${body.examMonth}`,
          kind: "awqaf",
          referenceId: Number(info.lastInsertRowid),
          createdBy: req.user!.id,
        });
      }

      return info.lastInsertRowid;
    });

    res.status(201).json({
      data: await db().get(`${SELECT_RECORD} WHERE a.id = ?`, [recordId]),
    });
  })
);

/**
 * PATCH /api/awqaf/:id — تغيير الحالة (مرشّح ← ناجح/لم ينجح) أو الشهر
 * أو الملاحظات. الحقول المتروكة تبقى كما هي.
 */
awqafRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(
      z.object({
        status: awqafStatus.optional(),
        examMonth: examMonth.optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
      req.body
    );

    const current = await db().get<{
      studentId: number;
      examMonth: string;
      status: string;
      notes: string | null;
    }>(
      `SELECT student_id AS "studentId", exam_month AS "examMonth", status, notes
       FROM awqaf_records WHERE id = ?`,
      [id]
    );
    if (!current) throw ApiError.notFound("السجل غير موجود");

    const nextMonth = body.examMonth ?? current.examMonth;

    if (nextMonth !== current.examMonth) {
      const clash = await db().get<{ id: number }>(
        "SELECT id FROM awqaf_records WHERE student_id = ? AND exam_month = ? AND id <> ?",
        [current.studentId, nextMonth, id]
      );
      if (clash) throw ApiError.conflict("الطالب مرشّح في هذا الشهر مسبقاً");
    }

    const nextStatus = body.status ?? current.status;

    await tx(async () => {
      await db().run(
        `UPDATE awqaf_records
         SET status = ?, exam_month = ?, notes = ?, updated_at = ${nowExpr()}
         WHERE id = ?`,
        [
          nextStatus,
          nextMonth,
          body.notes !== undefined ? body.notes : current.notes,
          id,
        ]
      );

      // مكافأة النجاح. الشرط على الانتقال لا على الحالة الجديدة وحدها:
      // تعديل الملاحظات على سجلّ ناجح لا يمنح النقاط ثانيةً.
      if (nextStatus === "passed" && current.status !== "passed") {
        await addPoints({
          studentId: current.studentId,
          delta: config.pointRules.awqafPassed,
          reason: `نجاح في سبر الأوقاف ${nextMonth}`,
          kind: "awqaf",
          referenceId: id,
          createdBy: req.user!.id,
        });
      }

      // الرجوع عن النجاح يسحب المكافأة. بدون هذا لا يكتمل المنع أعلاه:
      // ناجح ← لم ينجح ← ناجح كان سيمنح 100 مرّتين، والنتيجة الخاطئة
      // المصحَّحة كانت ستُبقي نقاطاً بلا سبب.
      if (nextStatus !== "passed" && current.status === "passed") {
        await revertPointsFor("awqaf", id);
      }
    });

    res.json({ data: await db().get(`${SELECT_RECORD} WHERE a.id = ?`, [id]) });
  })
);

/**
 * DELETE /api/awqaf/:id — حذف فعلي.
 *
 * خلافاً للطلاب والحلقات، سجلّ السبر ليس مرجعاً لبيانات أخرى (لا حضور
 * ولا تلاوات تشير إليه)، فلا معنى لتعطيله: الترشيح الخاطئ يُزال تماماً.
 *
 * تُسحب معه مكافأة النجاح إن كان ناجحاً: حركة النقاط تشير إلى السجلّ
 * بـ reference_id، فحذفه وحده يترك 100 نقطة بلا مصدر يفسّرها.
 */
awqafRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);

    const info = await tx(async () => {
      await revertPointsFor("awqaf", id);
      return db().run("DELETE FROM awqaf_records WHERE id = ?", [id]);
    });

    if (info.changes === 0) throw ApiError.notFound("السجل غير موجود");
    res.status(204).end();
  })
);
