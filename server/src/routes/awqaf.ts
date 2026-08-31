/**
 * شهادات وسبر الأوقاف — إدارة الطلاب المرشّحين لاختبارات وزارة الأوقاف
 * ونتائجهم فيها.
 *
 * الراوتر كلّه محصور بالمدير (requireStudentManager = ADMIN) على مستوى
 * الراوتر لا على كل مسار، حتى لا يُنسى مع أي مسار يُضاف لاحقاً.
 *
 * ── قيد النطاق ───────────────────────────────────────────────────────
 * كان الملف بلا قيد نطاق، بحجّة أن المدير يرى كل الحلقات. أبطلت الأقسامُ
 * هذه الحجّة: مدير القسم مدير أيضاً.
 *
 * وسجلّ السبر لا يحمل halaqa_id، فانتماؤه إلى قسمٍ يمرّ بالطالب — الحلقة
 * صفةُ الطالب لا صفةُ السبر. ولذلك القراءة مقيَّدة بـ applyStudentScope،
 * والكتابة محروسة بـ assertStudentAccess على الطالب المعنيّ.
 *
 * والحراسة على الطالب لا على السجلّ عمداً في PATCH و DELETE: القراءة
 * وحدها لا تكفي حارساً للكتابة — سجلٌّ يُقرأ بمعرّفه المباشر يتخطّى فلتر
 * القائمة، فلولا الفحص الصريح لعدّل مديرُ قسمٍ سجلَّ طالبٍ من قسم آخر
 * بمجرّد معرفة رقمه.
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
import { applyStudentScope, assertStudentAccess } from "../services/scope.js";
import { visibleStudent } from "../services/studentSql.js";

export const awqafRouter = Router();

awqafRouter.use(requireStudentManager);

/** حالة الطالب في دورة السبر — مفاتيح ثابتة تُترجَم في الواجهة. */
const awqafStatus = z.enum(["nominated", "passed", "failed"]);

/** شهر السبر: YYYY-MM. لا يوم فيه — الدورة تُعرَّف بشهرها لا بتاريخ محدّد. */
/**
 * الجزء المُختبَر: عدد صحيح من 1 إلى 30.
 *
 * حلّ محلّ الحقل الحرّ notes الذي كان يحمل الجزء نصّاً غير منضبط.
 */
const juz = z
  .number()
  .int()
  .min(1, "الجزء يجب أن يكون بين 1 و 30")
  .max(30, "الجزء يجب أن يكون بين 1 و 30");

/**
 * سبب حركة النقاط. الجزء اختياري: السجلّات القديمة (وما قبل حقل juz)
 * تُبقي النص القديم بلا قوس.
 */
const passReason = (month: string, juzNo: number | null | undefined) =>
  juzNo == null
    ? `نجاح في سبر الأوقاف ${month}`
    : `نجاح في سبر الأوقاف (الجزء ${juzNo}) - ${month}`;

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
         a.juz,
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

    // قيد النطاق: لا حاجة لفحص halaqaId المطلوبة على حدة — الحلقة خارج
    // النطاق تتقاطع مع القيد فتعطي قائمة فارغة، لا تسريباً
    await applyStudentScope(req.user!, "a.student_id", where, params);

    const sql = `${SELECT_RECORD}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.exam_month DESC, s.name`;

    const data = await db().all(sql, params);

    /*
     * الأشهر المسجَّلة كلها (لا أشهر الصفحة الحالية) — تغذّي قائمة الفلترة
     * فلا تختفي خيارات الأشهر الأخرى بمجرّد اختيار أحدها.
     *
     * مقيَّدة بالنطاق هي أيضاً: قائمةُ أشهرٍ غير مقيَّدة تُظهر لمدير القسم
     * شهراً لا سبر فيه لقسمه، فيختاره ويقع على جدول فارغ — وقد أفشى ضمناً
     * أن قسماً آخر سبر فيه.
     */
    const monthWhere: string[] = [];
    const monthParams: SqlParam[] = [];
    await applyStudentScope(req.user!, "a.student_id", monthWhere, monthParams);

    const months = await db().all<{ month: string }>(
      `SELECT DISTINCT a.exam_month AS month FROM awqaf_records a
       ${monthWhere.length ? `WHERE ${monthWhere.join(" AND ")}` : ""}
       ORDER BY month DESC`,
      monthParams
    );

    res.json({ data, meta: { months: months.map((m) => m.month) } });
  })
);

/** GET /api/awqaf/:id */
awqafRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);

    const record = await db().get<{ studentId: number }>(
      `${SELECT_RECORD} WHERE a.id = ?`,
      [id]
    );
    if (!record) throw ApiError.notFound("السجل غير موجود");

    await assertStudentAccess(req.user!, record.studentId);

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
        juz,
      }),
      req.body
    );

    // القسم أولاً: مدير القسم لا يرشّح طالباً من قسم آخر
    await assertStudentAccess(req.user!, body.studentId);

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
        `INSERT INTO awqaf_records (student_id, exam_month, status, juz, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [body.studentId, body.examMonth, body.status, body.juz, req.user!.id]
      );

      // الترشيح يبدأ عادةً بـ nominated، لكن المسار يقبل status صراحةً —
      // فالسجلّ المُنشأ ناجحاً يمنح مكافأته هنا لا في تعديل لاحق.
      if (body.status === "passed") {
        await addPoints({
          studentId: body.studentId,
          delta: config.pointRules.awqafPassed,
          reason: passReason(body.examMonth, body.juz),
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
 * أو الجزء. الحقول المتروكة تبقى كما هي.
 */
awqafRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(
      z.object({
        status: awqafStatus.optional(),
        examMonth: examMonth.optional(),
        juz: juz.optional(),
      }),
      req.body
    );

    const current = await db().get<{
      studentId: number;
      examMonth: string;
      status: string;
      juz: number | null;
    }>(
      `SELECT student_id AS "studentId", exam_month AS "examMonth", status, juz
       FROM awqaf_records WHERE id = ?`,
      [id]
    );
    if (!current) throw ApiError.notFound("السجل غير موجود");

    await assertStudentAccess(req.user!, current.studentId);

    const nextMonth = body.examMonth ?? current.examMonth;

    if (nextMonth !== current.examMonth) {
      const clash = await db().get<{ id: number }>(
        "SELECT id FROM awqaf_records WHERE student_id = ? AND exam_month = ? AND id <> ?",
        [current.studentId, nextMonth, id]
      );
      if (clash) throw ApiError.conflict("الطالب مرشّح في هذا الشهر مسبقاً");
    }

    const nextStatus = body.status ?? current.status;
    const nextJuz = body.juz !== undefined ? body.juz : current.juz;

    await tx(async () => {
      await db().run(
        `UPDATE awqaf_records
         SET status = ?, exam_month = ?, juz = ?, updated_at = ${nowExpr()}
         WHERE id = ?`,
        [nextStatus, nextMonth, nextJuz, id]
      );

      // مكافأة النجاح. الشرط على الانتقال لا على الحالة الجديدة وحدها:
      // تعديل الجزء على سجلّ ناجح لا يمنح النقاط ثانيةً.
      if (nextStatus === "passed" && current.status !== "passed") {
        await addPoints({
          studentId: current.studentId,
          delta: config.pointRules.awqafPassed,
          reason: passReason(nextMonth, nextJuz),
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

    // الوجود يُفحص قبل الحذف لا بعده: بدونه لا سبيل لمعرفة صاحب السجلّ
    // فيُحرَس، و changes === 0 وحدها لا تفرّق بين «غير موجود» و«ممنوع»
    const record = await db().get<{ studentId: number }>(
      `SELECT student_id AS "studentId" FROM awqaf_records WHERE id = ?`,
      [id]
    );
    if (!record) throw ApiError.notFound("السجل غير موجود");

    await assertStudentAccess(req.user!, record.studentId);

    await tx(async () => {
      await revertPointsFor("awqaf", id);
      return db().run("DELETE FROM awqaf_records WHERE id = ?", [id]);
    });

    res.status(204).end();
  })
);
