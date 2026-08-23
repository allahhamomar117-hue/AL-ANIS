import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { db, tx, type SqlParam } from "../db/index.js";
import { nowExpr } from "../db/sqlfn.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { attendanceStatus, idParam, isoDate, pagination, today } from "../lib/schemas.js";
import { addPoints, revertPointsFor } from "../services/points.js";
import { applyScope, assertHalaqaAccess } from "../services/scope.js";
import type { AuthUser } from "../middleware/auth.js";

export const attendanceRouter = Router();

interface SessionRow {
  id: number;
  halaqaId: number;
  halaqa: string;
  date: string;
  teacherStatus: "present" | "absent";
  notes: string | null;
}

const SELECT_SESSION = `
  SELECT a.id,
         a.halaqa_id            AS "halaqaId",
         COALESCE(h.name, '')   AS halaqa,
         a.date,
         a.teacher_status       AS "teacherStatus",
         a.notes
  FROM attendance_sessions a
  LEFT JOIN halaqat h ON h.id = a.halaqa_id
`;

/** يتحقق أن الجلسة ضمن نطاق المستخدم (تُستخدم قبل تعديل أو حذف جلسة). */
async function assertSessionAccess(user: AuthUser, sessionId: number): Promise<void> {
  const row = await db().get<{ halaqaId: number }>(
    `SELECT halaqa_id AS "halaqaId" FROM attendance_sessions WHERE id = ?`,
    [sessionId]
  );
  if (!row) throw ApiError.notFound("الجلسة غير موجودة");
  await assertHalaqaAccess(user, row.halaqaId);
}

function entriesOf(sessionId: number) {
  return db().all(
    `SELECT e.id, e.student_id AS "studentId", s.name, s.code,
            s.avatar_url AS "avatarUrl", e.status
     FROM attendance_entries e
     JOIN students s ON s.id = e.student_id
     WHERE e.session_id = ?
     ORDER BY s.name`,
    [sessionId]
  );
}

/**
 * GET /api/attendance/sessions?halaqaId=&from=&to=
 * سجل الحضور مجمّعاً بالجلسات (يغذّي صفحة "سجل الحضور").
 */
attendanceRouter.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const q = parse(
      pagination.extend({
        halaqaId: z.coerce.number().int().positive().optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
      }),
      req.query
    );

    const where: string[] = [];
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

    // المدرّس لا يرى إلا جلسات حلقاته
    await applyScope(req.user!, "a.halaqa_id", where, params);

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sessions = await db().all<SessionRow>(
      `${SELECT_SESSION} ${clause} ORDER BY a.date DESC, a.id DESC LIMIT ? OFFSET ?`,
      [...params, q.limit, q.offset]
    );

    // الجلسات قليلة في الصفحة الواحدة، فالتسلسل هنا أوضح من التوازي
    const data = [];
    for (const session of sessions) {
      data.push({ ...session, students: await entriesOf(session.id) });
    }

    res.json({ data });
  })
);

/**
 * GET /api/attendance/halaqat/:halaqaId?date=
 * يجهّز شاشة تسجيل الحضور: كل طلاب الحلقة مع حالتهم المسجّلة (أو "absent" افتراضياً).
 */
attendanceRouter.get(
  "/halaqat/:halaqaId",
  asyncHandler(async (req, res) => {
    const halaqaId = parse(idParam, req.params.halaqaId);
    await assertHalaqaAccess(req.user!, halaqaId);

    const { date } = parse(z.object({ date: isoDate.default(() => today()) }), req.query);

    const halaqa = await db().get(
      `SELECT h.id, h.name, COALESCE(u.name, '') AS teacher
       FROM halaqat h LEFT JOIN users u ON u.id = h.teacher_id
       WHERE h.id = ?`,
      [halaqaId]
    );
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const session = await db().get<SessionRow>(
      `${SELECT_SESSION} WHERE a.halaqa_id = ? AND a.date = ?`,
      [halaqaId, date]
    );

    const students = await db().all(
      `SELECT s.id, s.code, s.name, s.avatar_url AS "avatarUrl",
              COALESCE(e.status, 'absent') AS status
       FROM students s
       LEFT JOIN attendance_entries e
         ON e.student_id = s.id AND e.session_id = ?
       WHERE s.halaqa_id = ? AND s.is_active = TRUE
       ORDER BY s.name`,
      [session?.id ?? -1, halaqaId]
    );

    res.json({
      data: {
        halaqa,
        date,
        sessionId: session?.id ?? null,
        teacherStatus: session?.teacherStatus ?? "present",
        notes: session?.notes ?? null,
        recorded: Boolean(session),
        students,
      },
    });
  })
);

/**
 * POST /api/attendance
 * حفظ (أو تحديث) حضور حلقة في تاريخ معيّن — نفس حِمل صفحة AttendancePage.
 * يُمنح الحاضرون نقاطاً تلقائياً، وتُعاد النقاط عند إعادة الحفظ لنفس اليوم.
 */
attendanceRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        halaqaId: z.number().int().positive(),
        date: isoDate.default(() => today()),
        teacherStatus: z.enum(["present", "absent"]).default("present"),
        notes: z.string().max(500).nullable().optional(),
        students: z
          .array(
            z.object({
              id: z.number().int().positive(),
              status: attendanceStatus,
            })
          )
          .min(1, "يجب إرسال حالة طالب واحد على الأقل"),
      }),
      req.body
    );

    await assertHalaqaAccess(req.user!, body.halaqaId);

    const halaqa = await db().get("SELECT id FROM halaqat WHERE id = ?", [body.halaqaId]);
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const rows = await db().all<{ id: number }>(
      "SELECT id FROM students WHERE halaqa_id = ? AND is_active = TRUE",
      [body.halaqaId]
    );
    const validIds = new Set(rows.map((s) => s.id));

    const stranger = body.students.find((s) => !validIds.has(s.id));
    if (stranger) {
      throw ApiError.badRequest(`الطالب ${stranger.id} لا ينتمي إلى هذه الحلقة`);
    }

    const sessionId = await tx(async () => {
      await db().run(
        `INSERT INTO attendance_sessions (halaqa_id, date, teacher_status, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (halaqa_id, date) DO UPDATE SET
           teacher_status = excluded.teacher_status,
           notes          = excluded.notes,
           recorded_by    = excluded.recorded_by,
           updated_at     = ${nowExpr()}`,
        [body.halaqaId, body.date, body.teacherStatus, body.notes ?? null, req.user!.id]
      );

      const session = await db().get<{ id: number }>(
        "SELECT id FROM attendance_sessions WHERE halaqa_id = ? AND date = ?",
        [body.halaqaId, body.date]
      );
      const id = session!.id;

      // إعادة النقاط الممنوحة سابقاً لهذه الجلسة قبل إعادة الاحتساب
      await revertPointsFor("attendance", id);
      await db().run("DELETE FROM attendance_entries WHERE session_id = ?", [id]);

      for (const student of body.students) {
        await db().run(
          "INSERT INTO attendance_entries (session_id, student_id, status) VALUES (?, ?, ?)",
          [id, student.id, student.status]
        );
        if (student.status === "present" || student.status === "late") {
          await addPoints({
            studentId: student.id,
            delta: config.pointRules.attendancePresent,
            reason: `حضور ${body.date}`,
            kind: "attendance",
            referenceId: id,
            createdBy: req.user!.id,
          });
        }
      }

      return id;
    });

    const session = await db().get<SessionRow>(`${SELECT_SESSION} WHERE a.id = ?`, [sessionId]);
    res.status(201).json({ data: { ...session, students: await entriesOf(sessionId) } });
  })
);

/** GET /api/attendance/sessions/:id */
attendanceRouter.get(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const session = await db().get<SessionRow>(`${SELECT_SESSION} WHERE a.id = ?`, [id]);
    if (!session) throw ApiError.notFound("الجلسة غير موجودة");
    await assertHalaqaAccess(req.user!, session.halaqaId);
    res.json({ data: { ...session, students: await entriesOf(id) } });
  })
);

/** PATCH /api/attendance/sessions/:sessionId/students/:studentId — تعديل حالة طالب واحد. */
attendanceRouter.patch(
  "/sessions/:sessionId/students/:studentId",
  asyncHandler(async (req, res) => {
    const sessionId = parse(idParam, req.params.sessionId);
    const studentId = parse(idParam, req.params.studentId);
    const { status } = parse(z.object({ status: attendanceStatus }), req.body);

    const session = await db().get<{ id: number; date: string; halaqaId: number }>(
      `SELECT id, date, halaqa_id AS "halaqaId" FROM attendance_sessions WHERE id = ?`,
      [sessionId]
    );
    if (!session) throw ApiError.notFound("الجلسة غير موجودة");
    await assertHalaqaAccess(req.user!, session.halaqaId);

    await tx(async () => {
      const previous = await db().get<{ status: string }>(
        "SELECT status FROM attendance_entries WHERE session_id = ? AND student_id = ?",
        [sessionId, studentId]
      );

      await db().run(
        `INSERT INTO attendance_entries (session_id, student_id, status) VALUES (?, ?, ?)
         ON CONFLICT (session_id, student_id) DO UPDATE SET status = excluded.status`,
        [sessionId, studentId, status]
      );

      const wasPresent = previous ? ["present", "late"].includes(previous.status) : false;
      const isPresent = ["present", "late"].includes(status);

      if (wasPresent !== isPresent) {
        await addPoints({
          studentId,
          delta: isPresent
            ? config.pointRules.attendancePresent
            : -config.pointRules.attendancePresent,
          reason: `تعديل حضور ${session.date}`,
          kind: "attendance",
          referenceId: sessionId,
          createdBy: req.user!.id,
        });
      }
    });

    res.json({ data: await entriesOf(sessionId) });
  })
);

/** DELETE /api/attendance/sessions/:sessionId/students/:studentId */
attendanceRouter.delete(
  "/sessions/:sessionId/students/:studentId",
  asyncHandler(async (req, res) => {
    const sessionId = parse(idParam, req.params.sessionId);
    const studentId = parse(idParam, req.params.studentId);
    await assertSessionAccess(req.user!, sessionId);

    const info = await tx(async () => {
      const result = await db().run(
        "DELETE FROM attendance_entries WHERE session_id = ? AND student_id = ?",
        [sessionId, studentId]
      );

      if (result.changes > 0) {
        const rows = await db().all<{ id: number; delta: number }>(
          `SELECT id, delta FROM point_transactions
           WHERE kind = 'attendance' AND reference_id = ? AND student_id = ?`,
          [sessionId, studentId]
        );
        for (const row of rows) {
          await db().run("UPDATE students SET points = points - ? WHERE id = ?", [
            row.delta,
            studentId,
          ]);
          await db().run("DELETE FROM point_transactions WHERE id = ?", [row.id]);
        }
      }
      return result;
    });

    if (info.changes === 0) throw ApiError.notFound("السجل غير موجود");
    res.status(204).end();
  })
);

/** DELETE /api/attendance/sessions/:id — حذف الجلسة كاملة وإعادة نقاطها. */
attendanceRouter.delete(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertSessionAccess(req.user!, id);

    const info = await tx(async () => {
      await revertPointsFor("attendance", id);
      return db().run("DELETE FROM attendance_sessions WHERE id = ?", [id]);
    });

    if (info.changes === 0) throw ApiError.notFound("الجلسة غير موجودة");
    res.status(204).end();
  })
);
