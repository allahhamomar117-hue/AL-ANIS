import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { db, tx } from "../db/index.js";
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
         a.halaqa_id            AS halaqaId,
         COALESCE(h.name, '')   AS halaqa,
         a.date,
         a.teacher_status       AS teacherStatus,
         a.notes
  FROM attendance_sessions a
  LEFT JOIN halaqat h ON h.id = a.halaqa_id
`;

/** يتحقق أن الجلسة ضمن نطاق المستخدم (تُستخدم قبل تعديل أو حذف جلسة). */
function assertSessionAccess(user: AuthUser, sessionId: number): void {
  const row = db
    .prepare("SELECT halaqa_id AS halaqaId FROM attendance_sessions WHERE id = ?")
    .get(sessionId) as { halaqaId: number } | undefined;
  if (!row) throw ApiError.notFound("الجلسة غير موجودة");
  assertHalaqaAccess(user, row.halaqaId);
}

function entriesOf(sessionId: number) {
  return db
    .prepare(
      `SELECT e.id, e.student_id AS studentId, s.name, s.code,
              s.avatar_url AS avatarUrl, e.status
       FROM attendance_entries e
       JOIN students s ON s.id = e.student_id
       WHERE e.session_id = ?
       ORDER BY s.name`
    )
    .all(sessionId);
}

/**
 * GET /api/attendance/sessions?halaqaId=&from=&to=
 * سجل الحضور مجمّعاً بالجلسات (يغذّي صفحة "سجل الحضور").
 */
attendanceRouter.get(
  "/sessions",
  asyncHandler((req, res) => {
    const q = parse(
      pagination.extend({
        halaqaId: z.coerce.number().int().positive().optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
      }),
      req.query
    );

    const where: string[] = [];
    const params: unknown[] = [];
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
    applyScope(req.user!, "a.halaqa_id", where, params);

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sessions = db
      .prepare(`${SELECT_SESSION} ${clause} ORDER BY a.date DESC, a.id DESC LIMIT ? OFFSET ?`)
      .all(...params, q.limit, q.offset) as SessionRow[];

    res.json({
      data: sessions.map((s) => ({ ...s, students: entriesOf(s.id) })),
    });
  })
);

/**
 * GET /api/attendance/halaqat/:halaqaId?date=
 * يجهّز شاشة تسجيل الحضور: كل طلاب الحلقة مع حالتهم المسجّلة (أو "absent" افتراضياً).
 */
attendanceRouter.get(
  "/halaqat/:halaqaId",
  asyncHandler((req, res) => {
    const halaqaId = parse(idParam, req.params.halaqaId);
    assertHalaqaAccess(req.user!, halaqaId);

    const { date } = parse(z.object({ date: isoDate.default(() => today()) }), req.query);

    const halaqa = db
      .prepare(
        `SELECT h.id, h.name, COALESCE(u.name, '') AS teacher
         FROM halaqat h LEFT JOIN users u ON u.id = h.teacher_id
         WHERE h.id = ?`
      )
      .get(halaqaId);
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const session = db
      .prepare(`${SELECT_SESSION} WHERE a.halaqa_id = ? AND a.date = ?`)
      .get(halaqaId, date) as SessionRow | undefined;

    const students = db
      .prepare(
        `SELECT s.id, s.code, s.name, s.avatar_url AS avatarUrl,
                COALESCE(e.status, 'absent') AS status
         FROM students s
         LEFT JOIN attendance_entries e
           ON e.student_id = s.id AND e.session_id = ?
         WHERE s.halaqa_id = ? AND s.is_active = 1
         ORDER BY s.name`
      )
      .all(session?.id ?? -1, halaqaId);

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
  asyncHandler((req, res) => {
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

    assertHalaqaAccess(req.user!, body.halaqaId);

    const halaqa = db.prepare("SELECT id FROM halaqat WHERE id = ?").get(body.halaqaId);
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const validIds = new Set(
      (
        db
          .prepare("SELECT id FROM students WHERE halaqa_id = ? AND is_active = 1")
          .all(body.halaqaId) as { id: number }[]
      ).map((s) => s.id)
    );
    const stranger = body.students.find((s) => !validIds.has(s.id));
    if (stranger) {
      throw ApiError.badRequest(`الطالب ${stranger.id} لا ينتمي إلى هذه الحلقة`);
    }

    const sessionId = tx(() => {
      db.prepare(
        `INSERT INTO attendance_sessions (halaqa_id, date, teacher_status, notes, recorded_by)
         VALUES (@halaqaId, @date, @teacherStatus, @notes, @recordedBy)
         ON CONFLICT (halaqa_id, date) DO UPDATE SET
           teacher_status = excluded.teacher_status,
           notes          = excluded.notes,
           recorded_by    = excluded.recorded_by,
           updated_at     = datetime('now')`
      ).run({
        halaqaId: body.halaqaId,
        date: body.date,
        teacherStatus: body.teacherStatus,
        notes: body.notes ?? null,
        recordedBy: req.user!.id,
      });

      const { id } = db
        .prepare("SELECT id FROM attendance_sessions WHERE halaqa_id = ? AND date = ?")
        .get(body.halaqaId, body.date) as { id: number };

      // إعادة النقاط الممنوحة سابقاً لهذه الجلسة قبل إعادة الاحتساب
      revertPointsFor("attendance", id);
      db.prepare("DELETE FROM attendance_entries WHERE session_id = ?").run(id);

      const insert = db.prepare(
        "INSERT INTO attendance_entries (session_id, student_id, status) VALUES (?, ?, ?)"
      );
      for (const student of body.students) {
        insert.run(id, student.id, student.status);
        if (student.status === "present" || student.status === "late") {
          addPoints({
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

    const session = db.prepare(`${SELECT_SESSION} WHERE a.id = ?`).get(sessionId) as SessionRow;
    res.status(201).json({ data: { ...session, students: entriesOf(sessionId) } });
  })
);

/** GET /api/attendance/sessions/:id */
attendanceRouter.get(
  "/sessions/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const session = db.prepare(`${SELECT_SESSION} WHERE a.id = ?`).get(id) as
      | SessionRow
      | undefined;
    if (!session) throw ApiError.notFound("الجلسة غير موجودة");
    assertHalaqaAccess(req.user!, session.halaqaId);
    res.json({ data: { ...session, students: entriesOf(id) } });
  })
);

/** PATCH /api/attendance/sessions/:sessionId/students/:studentId — تعديل حالة طالب واحد. */
attendanceRouter.patch(
  "/sessions/:sessionId/students/:studentId",
  asyncHandler((req, res) => {
    const sessionId = parse(idParam, req.params.sessionId);
    const studentId = parse(idParam, req.params.studentId);
    const { status } = parse(z.object({ status: attendanceStatus }), req.body);

    const session = db
      .prepare("SELECT id, date, halaqa_id AS halaqaId FROM attendance_sessions WHERE id = ?")
      .get(sessionId) as { id: number; date: string; halaqaId: number } | undefined;
    if (!session) throw ApiError.notFound("الجلسة غير موجودة");
    assertHalaqaAccess(req.user!, session.halaqaId);

    tx(() => {
      const previous = db
        .prepare("SELECT status FROM attendance_entries WHERE session_id = ? AND student_id = ?")
        .get(sessionId, studentId) as { status: string } | undefined;

      db.prepare(
        `INSERT INTO attendance_entries (session_id, student_id, status) VALUES (?, ?, ?)
         ON CONFLICT (session_id, student_id) DO UPDATE SET status = excluded.status`
      ).run(sessionId, studentId, status);

      const wasPresent = previous ? ["present", "late"].includes(previous.status) : false;
      const isPresent = ["present", "late"].includes(status);

      if (wasPresent !== isPresent) {
        addPoints({
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

    res.json({ data: entriesOf(sessionId) });
  })
);

/** DELETE /api/attendance/sessions/:sessionId/students/:studentId */
attendanceRouter.delete(
  "/sessions/:sessionId/students/:studentId",
  asyncHandler((req, res) => {
    const sessionId = parse(idParam, req.params.sessionId);
    const studentId = parse(idParam, req.params.studentId);
    assertSessionAccess(req.user!, sessionId);

    const info = tx(() => {
      const result = db
        .prepare("DELETE FROM attendance_entries WHERE session_id = ? AND student_id = ?")
        .run(sessionId, studentId);

      if (result.changes > 0) {
        const rows = db
          .prepare(
            `SELECT id, delta FROM point_transactions
             WHERE kind = 'attendance' AND reference_id = ? AND student_id = ?`
          )
          .all(sessionId, studentId) as { id: number; delta: number }[];
        for (const row of rows) {
          db.prepare("UPDATE students SET points = points - ? WHERE id = ?").run(
            row.delta,
            studentId
          );
          db.prepare("DELETE FROM point_transactions WHERE id = ?").run(row.id);
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
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertSessionAccess(req.user!, id);

    const info = tx(() => {
      revertPointsFor("attendance", id);
      return db.prepare("DELETE FROM attendance_sessions WHERE id = ?").run(id);
    });

    if (info.changes === 0) throw ApiError.notFound("الجلسة غير موجودة");
    res.status(204).end();
  })
);
