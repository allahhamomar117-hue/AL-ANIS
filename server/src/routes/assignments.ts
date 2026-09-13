/**
 * المقرَّرات (الواجبات) — لقسم المكثفة وحده.
 *
 * الأستاذ يكتب عنوان مقرَّر اليوم لحلقته ("حفظ صفحة 12"، "مراجعة جزء
 * عمّ")، ثم يؤشّر بجانب كل طالب أنجزه. الإنجاز يمنح نقاطاً ثابتة
 * (config.pointRules.assignmentDone)، والتراجع عنه يسحبها.
 *
 * ── بنيته من الحضور ─────────────────────────────────────────────────
 * الشكل مقصود أن يكون نظير attendance.ts: مقرَّر واحد لكل حلقة في اليوم
 * كجلسة الحضور، وطلاب الحلقة كلّهم يظهرون في الورقة بحالتهم المسجَّلة أو
 * "لم يُنجز" افتراضاً. فمن عرف شاشةَ الحضور عرف هذه بلا تعلّم جديد.
 *
 * ── حارسان لا حارس واحد ─────────────────────────────────────────────
 * كل مسار هنا يمرّ بـ assertHalaqaAccess ثم assertIntensiveHalaqa:
 * الأول يسأل "هل الحلقة ضمن نطاقك؟" والثاني "هل تقبل هذه الميزة؟".
 * وهما سؤالان مستقلّان — انظر التعليق على assertIntensiveHalaqa.
 *
 * ── مرجع النقاط ─────────────────────────────────────────────────────
 * حركة النقاط تُقيَّد بـ reference_id = معرّف صفّ student_assignments لا
 * معرّف المقرَّر، فيصير سحب نقاط طالب واحد استدعاءً واحداً بلا فلترة
 * يدوية على student_id — وهي الفلترة التي اضطُرّ إليها مسار الحضور لأن
 * مرجعه الجلسةُ المشتركة بين كل طلابها.
 */
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { db, tx } from "../db/index.js";
import { nowExpr } from "../db/sqlfn.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam, isoDate, today } from "../lib/schemas.js";
import { addPoints, revertPointsFor } from "../services/points.js";
import { assertHalaqaAccess, assertIntensiveHalaqa } from "../services/scope.js";
import { visibleStudent } from "../services/studentSql.js";
import type { AuthUser } from "../middleware/auth.js";

export const assignmentsRouter = Router();

/**
 * عنوان المقرَّر: نصّ غير فارغ بعد التشذيب.
 *
 * التشذيب قبل الفحص لا بعده: عنوانٌ من مسافات وحدها يمرّ من min(1) على
 * النصّ الخام ثم يُخزَّن فارغاً، فيظهر في التقرير اليومي شارةً خضراء
 * بلا كلمة.
 */
const assignmentTitle = z
  .string()
  .trim()
  .min(1, "عنوان المقرَّر مطلوب")
  .max(200, "عنوان المقرَّر طويل — 200 حرف حدّاً أقصى");

/** الحارسان معاً — كل مسار يبدأ بهما. */
async function assertAssignmentHalaqa(user: AuthUser, halaqaId: number): Promise<void> {
  await assertHalaqaAccess(user, halaqaId);
  await assertIntensiveHalaqa(halaqaId);
}

interface AssignmentRow {
  id: number;
  halaqaId: number;
  title: string;
  date: string;
}

const SELECT_ASSIGNMENT = `
  SELECT a.id,
         a.halaqa_id AS "halaqaId",
         a.title,
         a.date
  FROM assignments a
`;

/**
 * ورقة الحلقة: طلابها كلّهم مع حالة إنجاز كلٍّ منهم.
 *
 * LEFT JOIN لا INNER: الطالب الذي لم يُنجز يجب أن يظهر في القائمة بزرّه
 * غيرَ مفعّل، لا أن يغيب عنها.
 *
 * و"completedId" يصل الواجهةَ لا الخادمَ وحده: هو معرّف صفّ الإنجاز،
 * ووجوده (لا قيمته) هو ما يقرأه الزرّ حالةً مسجَّلة.
 */
function studentsOf(halaqaId: number, assignmentId: number | null) {
  return db().all(
    `SELECT s.id, s.code, s.name, s.avatar_url AS "avatarUrl",
            sa.id AS "completedId"
     FROM students s
     LEFT JOIN student_assignments sa
       ON sa.student_id = s.id AND sa.assignment_id = ?
     WHERE s.halaqa_id = ? AND ${visibleStudent("s")}
     ORDER BY s.name`,
    [assignmentId ?? -1, halaqaId]
  );
}

/**
 * GET /api/assignments/halaqat/:halaqaId?date=
 * يجهّز شاشة تسجيل المقرَّرات — نظير GET /api/attendance/halaqat/:id.
 *
 * بلا مقرَّر لليوم تعود assignment = null والطلاب كلّهم غير منجزين: الشاشة
 * تفتح على حقل عنوان فارغ ينشئ المقرَّر عند أول حفظ.
 */
assignmentsRouter.get(
  "/halaqat/:halaqaId",
  asyncHandler(async (req, res) => {
    const halaqaId = parse(idParam, req.params.halaqaId);
    await assertAssignmentHalaqa(req.user!, halaqaId);

    const { date } = parse(z.object({ date: isoDate.default(() => today()) }), req.query);

    const halaqa = await db().get(
      `SELECT h.id, h.name, COALESCE(u.name, '') AS teacher
       FROM halaqat h LEFT JOIN users u ON u.id = h.teacher_id
       WHERE h.id = ?`,
      [halaqaId]
    );
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const assignment = await db().get<AssignmentRow>(
      `${SELECT_ASSIGNMENT} WHERE a.halaqa_id = ? AND a.date = ?`,
      [halaqaId, date]
    );

    res.json({
      data: {
        halaqa,
        date,
        assignmentId: assignment?.id ?? null,
        title: assignment?.title ?? "",
        recorded: Boolean(assignment),
        /** نقاط الإنجاز الواحد — تعرضها الواجهة بدل أن تُثبّت 25 في نصّها. */
        pointsPerCompletion: config.pointRules.assignmentDone,
        students: await studentsOf(halaqaId, assignment?.id ?? null),
      },
    });
  })
);

/**
 * POST /api/assignments
 * ينشئ مقرَّر اليوم أو يحدّث عنوانه — ورقة واحدة لكل حلقة في اليوم.
 *
 * ON CONFLICT على (halaqa_id, date) هو ما يجعل الحفظ المتكرّر تحريراً لا
 * مقرَّراً ثانياً، وهو نفس ما يفعله حفظ الحضور. تغيير العنوان لا يمسّ
 * الإنجازات المسجَّلة ولا نقاطها: تصحيح صياغةٍ لا إلغاءُ عمل.
 */
assignmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        halaqaId: z.number().int().positive(),
        title: assignmentTitle,
        date: isoDate.default(() => today()),
      }),
      req.body
    );

    await assertAssignmentHalaqa(req.user!, body.halaqaId);

    await db().run(
      `INSERT INTO assignments (halaqa_id, title, date, created_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (halaqa_id, date) DO UPDATE SET
         title      = excluded.title,
         updated_at = ${nowExpr()}`,
      [body.halaqaId, body.title, body.date, req.user!.id]
    );

    // المعرّف يُقرأ لا يُؤخذ من نتيجة الإدراج: في مسار التحديث (DO UPDATE)
    // لا يُنشأ صفّ جديد، فـ lastInsertRowid لا يدلّ على شيء.
    const assignment = await db().get<AssignmentRow>(
      `${SELECT_ASSIGNMENT} WHERE a.halaqa_id = ? AND a.date = ?`,
      [body.halaqaId, body.date]
    );

    res.status(201).json({
      data: {
        ...assignment,
        students: await studentsOf(body.halaqaId, assignment!.id),
      },
    });
  })
);

/**
 * يقرأ مقرَّراً ويتحقق من الحارسين — تُستدعى قبل كل تعديل على مقرَّر قائم.
 */
async function loadAssignment(user: AuthUser, id: number): Promise<AssignmentRow> {
  const assignment = await db().get<AssignmentRow>(`${SELECT_ASSIGNMENT} WHERE a.id = ?`, [id]);
  if (!assignment) throw ApiError.notFound("المقرَّر غير موجود");
  await assertAssignmentHalaqa(user, assignment.halaqaId);
  return assignment;
}

/** PATCH /api/assignments/:id — تعديل العنوان وحده. */
assignmentsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const assignment = await loadAssignment(req.user!, id);

    const { title } = parse(z.object({ title: assignmentTitle }), req.body);

    await db().run(
      `UPDATE assignments SET title = ?, updated_at = ${nowExpr()} WHERE id = ?`,
      [title, id]
    );

    res.json({
      data: {
        ...assignment,
        title,
        students: await studentsOf(assignment.halaqaId, id),
      },
    });
  })
);

/**
 * POST /api/assignments/:id/students/:studentId — تسجيل إنجاز طالب.
 *
 * الاستدعاء المتكرّر لا يضاعف النقاط: القيد UNIQUE يمنع الصفّ الثاني،
 * والفحص المسبق يجعل النداء المكرّر لا-عملية صامتة بدل خطأ 409 — فضغطة
 * مزدوجة على الزرّ لا تُنتج رسالة خطأ للأستاذ.
 */
assignmentsRouter.post(
  "/:id/students/:studentId",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const studentId = parse(idParam, req.params.studentId);
    const assignment = await loadAssignment(req.user!, id);

    // الطالب من حلقة المقرَّر فعلاً — لا يكفي أن يكون ضمن نطاق الأستاذ
    const student = await db().get<{ id: number }>(
      `SELECT id FROM students
       WHERE id = ? AND halaqa_id = ? AND ${visibleStudent("")}`,
      [studentId, assignment.halaqaId]
    );
    if (!student) throw ApiError.badRequest("الطالب لا ينتمي إلى حلقة هذا المقرَّر");

    await tx(async () => {
      const existing = await db().get<{ id: number }>(
        "SELECT id FROM student_assignments WHERE assignment_id = ? AND student_id = ?",
        [id, studentId]
      );
      if (existing) return;

      const info = await db().run(
        `INSERT INTO student_assignments (assignment_id, student_id, recorded_by)
         VALUES (?, ?, ?)`,
        [id, studentId, req.user!.id]
      );

      await addPoints({
        studentId,
        delta: config.pointRules.assignmentDone,
        reason: `إنجاز مقرَّر «${assignment.title}» - ${assignment.date}`,
        kind: "assignment",
        // مرجع الحركة صفّ الإنجاز لا المقرَّر — راجع رأس الملف
        referenceId: info.lastInsertRowid,
        createdBy: req.user!.id,
      });
    });

    res.status(201).json({ data: await studentsOf(assignment.halaqaId, id) });
  })
);

/**
 * DELETE /api/assignments/:id/students/:studentId — التراجع عن الإنجاز.
 *
 * سحب النقاط قبل حذف الصفّ لا بعده: الحذف يسقط المرجع الذي تبحث به
 * revertPointsFor، فترتيبٌ معكوس يترك النقاط في رصيد الطالب بلا إنجاز
 * يقابلها ولا سبيل إلى العثور عليها لاحقاً.
 */
assignmentsRouter.delete(
  "/:id/students/:studentId",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const studentId = parse(idParam, req.params.studentId);
    await loadAssignment(req.user!, id);

    const row = await db().get<{ id: number }>(
      "SELECT id FROM student_assignments WHERE assignment_id = ? AND student_id = ?",
      [id, studentId]
    );
    if (!row) throw ApiError.notFound("لا يوجد إنجاز مسجَّل لهذا الطالب");

    await tx(async () => {
      await revertPointsFor("assignment", row.id);
      await db().run("DELETE FROM student_assignments WHERE id = ?", [row.id]);
    });

    res.status(204).end();
  })
);

/**
 * DELETE /api/assignments/:id — حذف المقرَّر كاملاً وإعادة كل نقاطه.
 *
 * ON DELETE CASCADE يكنس صفوف الإنجاز، لكنه لا يعرف شيئاً عن النقاط —
 * فتُسحب هنا صفّاً صفّاً قبل الحذف. لو تُرك الأمر للـ CASCADE وحده لبقي
 * في أرصدة الطلاب نقاطُ مقرَّرٍ لا وجود له.
 */
assignmentsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await loadAssignment(req.user!, id);

    await tx(async () => {
      const rows = await db().all<{ id: number }>(
        "SELECT id FROM student_assignments WHERE assignment_id = ?",
        [id]
      );
      for (const row of rows) {
        await revertPointsFor("assignment", row.id);
      }

      await db().run("DELETE FROM assignments WHERE id = ?", [id]);
    });

    res.status(204).end();
  })
);
