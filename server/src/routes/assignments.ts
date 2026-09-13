/**
 * المقرَّرات (الواجبات) — لقسم المكثفة وحده.
 *
 * الأستاذ يكتب عنوان مقرَّر اليوم لحلقته ("حفظ صفحة 12"، "مراجعة جزء
 * عمّ")، ويؤشّر بجانب كل طالب أنجزه، ثم يحفظ الورقة دفعةً واحدة. كل
 * إنجاز يمنح نقاطاً ثابتة (config.pointRules.assignmentDone)، وسحبُه في
 * تعديل لاحق يستردّها.
 *
 * ── بنيته من الحضور ─────────────────────────────────────────────────
 * الشكل مقصود أن يكون نظير attendance.ts حرفياً: مقرَّر واحد لكل حلقة في
 * اليوم كجلسة الحضور، وحفظٌ جماعي واحد (POST /) يقبل الورقة كاملة ويكون
 * آمناً للتكرار. فمن عرف شاشةَ الحضور عرف هذه بلا تعلّم جديد.
 *
 * ── لماذا لا مسارات لكل طالب؟ ───────────────────────────────────────
 * كانت هنا POST/DELETE لكل طالب على حدة تخدم واجهةً تُرسل عند كل ضغطة.
 * أُسقطت مع تحوّل الواجهة إلى الحفظ الجماعي: طريقان للكتابة إلى الحالة
 * نفسها يعنيان قاعدتَي نقاطٍ يجب أن تبقيا متطابقتين إلى الأبد، وهذا
 * ثمنٌ بلا مقابل ما دام لا مستهلك للطريق الثاني.
 *
 * ── المزامنة بالفرق لا بالمسح وإعادة البناء ─────────────────────────
 * الحفظ يقارن القائمة الواردة بالمسجَّلة ويحرّك الفرق وحده. وهذا يخالف
 * مسار الحضور الذي يمسح مدخلاته ويعيد بناءها في كل حفظ — والاختلاف
 * مقصود: صفّ الإنجاز هو مرجعُ حركة النقاط، فمسحُ الكل وإعادةُ إدخاله
 * يُنشئ معرّفات جديدة، أي أنه يُلغي نقاط كل الطلاب ويمنحها من جديد في كل
 * حفظ. فيمتلئ سجلّ نقاط الطالب بحركات وهمية لا يقابلها عملٌ منه، وتتغيّر
 * تواريخها فتنزلق أرقام التقارير اليومية.
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
import { db, tx, type SqlParam } from "../db/index.js";
import { nowExpr } from "../db/sqlfn.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam, isoDate, pagination, today } from "../lib/schemas.js";
import { addPoints, revertPointsFor } from "../services/points.js";
import { applyScope, assertHalaqaAccess, assertIntensiveHalaqa } from "../services/scope.js";
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
  halaqa: string;
  title: string;
  date: string;
}

const SELECT_ASSIGNMENT = `
  SELECT a.id,
         a.halaqa_id          AS "halaqaId",
         COALESCE(h.name, '') AS halaqa,
         a.title,
         a.date
  FROM assignments a
  LEFT JOIN halaqat h ON h.id = a.halaqa_id
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

/** المنجِزون في مقرَّر — يغذّي بطاقات صفحة السجلّات. */
function completionsOf(assignmentId: number) {
  return db().all(
    `SELECT sa.id, sa.student_id AS "studentId", s.name, s.code,
            s.avatar_url AS "avatarUrl"
     FROM student_assignments sa
     JOIN students s ON s.id = sa.student_id
     WHERE sa.assignment_id = ?
     ORDER BY s.name`,
    [assignmentId]
  );
}

/**
 * GET /api/assignments?halaqaId=&from=&to=
 * سجلّ المقرَّرات السابقة مع منجِزي كلٍّ منها — يغذّي صفحة "سجل المقرَّرات".
 *
 * القيد على القسم مكتوب في الاستعلام لا بـ assertIntensiveHalaqa: هذه
 * قائمةٌ بلا حلقة بعينها (قد تُطلب بلا halaqaId أصلاً)، فالحارس الذي
 * يفحص حلقةً واحدة لا محلّ له. وبدون القيد كانت القائمة ستبقى فارغة
 * فعلياً لغير المكثفة — لكن "فارغة فعلياً" ليست ضماناً، والقيد يجعلها
 * فارغة يقيناً.
 */
assignmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = parse(
      pagination.extend({
        halaqaId: z.coerce.number().int().positive().optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
      }),
      req.query
    );

    const where: string[] = ["h.department = 'INTENSIVE'"];
    const params: SqlParam[] = [];

    if (q.halaqaId) {
      where.push("a.halaqa_id = ?");
      params.push(q.halaqaId);
    }
    if (q.from) {
      where.push("a.date >= ?");
      params.push(q.from);
    }
    if (q.to) {
      where.push("a.date <= ?");
      params.push(q.to);
    }

    // المدرّس لا يرى إلا مقرَّرات حلقاته
    await applyScope(req.user!, "a.halaqa_id", where, params);

    const rows = await db().all<AssignmentRow>(
      `${SELECT_ASSIGNMENT} WHERE ${where.join(" AND ")}
       ORDER BY a.date DESC, a.id DESC LIMIT ? OFFSET ?`,
      [...params, q.limit, q.offset]
    );

    // السجلّات قليلة في الصفحة الواحدة، فالتسلسل هنا أوضح من التوازي
    const data = [];
    for (const row of rows) {
      data.push({ ...row, students: await completionsOf(row.id) });
    }

    res.json({ data });
  })
);

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
 * حفظ ورقة مقرَّر اليوم كاملةً — نظير POST /api/attendance حِملاً وسلوكاً.
 *
 * الحِمل: العنوان وقائمة معرّفات المنجِزين. والقائمة هي الحالة النهائية
 * المطلوبة لا إضافةً عليها: من غاب عنها يُسحب إنجازه ونقاطه. ولهذا
 * `students` مطلوبة صراحةً ولو فارغة — حذفُها من الحِمل كان سيعني
 * "لا تغيّر شيئاً" و"امسح الجميع" معاً بلا تمييز.
 *
 * آمن للتكرار: ON CONFLICT على (halaqa_id, date) يجعل الحفظ الثاني
 * تحريراً للمقرَّر نفسه، والمزامنة بالفرق تجعل حفظ الورقة بلا تغيير
 * لا-عملية تامّة — لا حركة نقاط ولا صفّ جديد.
 */
assignmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        halaqaId: z.number().int().positive(),
        title: assignmentTitle,
        date: isoDate.default(() => today()),
        /** معرّفات الطلاب المنجِزين — الحالة النهائية للورقة. */
        students: z.array(z.number().int().positive()),
      }),
      req.body
    );

    await assertAssignmentHalaqa(req.user!, body.halaqaId);

    // الطلاب من الحلقة فعلاً — لا يكفي أن يكونوا ضمن نطاق الأستاذ
    const rows = await db().all<{ id: number }>(
      `SELECT id FROM students WHERE halaqa_id = ? AND ${visibleStudent("")}`,
      [body.halaqaId]
    );
    const validIds = new Set(rows.map((s) => s.id));

    const stranger = body.students.find((id) => !validIds.has(id));
    if (stranger) {
      throw ApiError.badRequest(`الطالب ${stranger} لا ينتمي إلى هذه الحلقة`);
    }

    // التكرار في الحِمل لا يعني إنجازين: القائمة مجموعةٌ لا سلسلة
    const wanted = new Set(body.students);

    const assignmentId = await tx(async () => {
      await db().run(
        `INSERT INTO assignments (halaqa_id, title, date, created_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (halaqa_id, date) DO UPDATE SET
           title      = excluded.title,
           updated_at = ${nowExpr()}`,
        [body.halaqaId, body.title, body.date, req.user!.id]
      );

      // المعرّف يُقرأ لا يُؤخذ من نتيجة الإدراج: في مسار التحديث
      // (DO UPDATE) لا يُنشأ صفّ جديد، فـ lastInsertRowid لا يدلّ على شيء.
      const assignment = await db().get<{ id: number }>(
        "SELECT id FROM assignments WHERE halaqa_id = ? AND date = ?",
        [body.halaqaId, body.date]
      );
      const id = assignment!.id;

      const existing = await db().all<{ id: number; studentId: number }>(
        `SELECT id, student_id AS "studentId" FROM student_assignments WHERE assignment_id = ?`,
        [id]
      );
      const existingBy = new Map(existing.map((row) => [row.studentId, row.id]));

      // المسحوبون: مسجَّلون ولم يعودوا في القائمة — تُستردّ نقاطهم
      for (const row of existing) {
        if (wanted.has(row.studentId)) continue;
        await revertPointsFor("assignment", row.id);
        await db().run("DELETE FROM student_assignments WHERE id = ?", [row.id]);
      }

      // المضافون: في القائمة ولم يكونوا مسجَّلين — يُمنحون النقاط
      for (const studentId of wanted) {
        if (existingBy.has(studentId)) continue;

        const info = await db().run(
          `INSERT INTO student_assignments (assignment_id, student_id, recorded_by)
           VALUES (?, ?, ?)`,
          [id, studentId, req.user!.id]
        );

        await addPoints({
          studentId,
          delta: config.pointRules.assignmentDone,
          reason: `إنجاز مقرَّر «${body.title}» - ${body.date}`,
          kind: "assignment",
          // مرجع الحركة صفّ الإنجاز لا المقرَّر — راجع رأس الملف
          referenceId: info.lastInsertRowid,
          createdBy: req.user!.id,
        });
      }

      /*
       * الباقون (مسجَّلون وما زالوا في القائمة) لا يُمسّون البتّة: لا حذف
       * ولا إعادة إدخال. وهذا هو صُلب المزامنة بالفرق — راجع رأس الملف.
       *
       * ⚠ ولا تُحدَّث نقاطهم عند تغيير العنوان: سبب الحركة يحفظ العنوان
       *   القديم. مقصود — السبب سجلٌّ لما جرى وقتَه، وتصحيح صياغةِ عنوانٍ
       *   اليوم لا يعيد كتابة تاريخ ما مُنح بالأمس.
       */

      return id;
    });

    const assignment = await db().get<AssignmentRow>(`${SELECT_ASSIGNMENT} WHERE a.id = ?`, [
      assignmentId,
    ]);

    res.status(201).json({
      data: {
        ...assignment,
        students: await studentsOf(body.halaqaId, assignmentId),
      },
    });
  })
);

/** يقرأ مقرَّراً ويتحقق من الحارسين — تُستدعى قبل أي تعديل على مقرَّر قائم. */
async function loadAssignment(user: AuthUser, id: number): Promise<AssignmentRow> {
  const assignment = await db().get<AssignmentRow>(`${SELECT_ASSIGNMENT} WHERE a.id = ?`, [id]);
  if (!assignment) throw ApiError.notFound("المقرَّر غير موجود");
  await assertAssignmentHalaqa(user, assignment.halaqaId);
  return assignment;
}

/** GET /api/assignments/:id — مقرَّر واحد بمنجِزيه. */
assignmentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const assignment = await loadAssignment(req.user!, id);
    res.json({ data: { ...assignment, students: await completionsOf(id) } });
  })
);

/**
 * DELETE /api/assignments/:id — حذف سجلّ اليوم كاملاً وإعادة كل نقاطه.
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
