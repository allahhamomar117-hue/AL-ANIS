import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam, isoDate, today } from "../lib/schemas.js";
import { assertHalaqaAccess, assertStudentAccess, halaqaFilter } from "../services/scope.js";
import { JUZ_AMMA, surahByNumber } from "../lib/juzAmma.js";

export const reportsRouter = Router();

/**
 * عدد الصفحات لتلاوة واحدة داخل SQL — نفس قواعد recitationPages في
 * services/points.ts: السورة بوزنها في جزء عمّ (سور تتقاسم الصفحة الواحدة)،
 * نصف الصفحة 0.5، والمدى بعدد صفحاته شاملاً الطرفين، وما عداه صفحة.
 * الأوزان تُبنى من JUZ_AMMA فيبقى مصدر الحقيقة ملفاً واحداً.
 */
const SURAH_PAGES_CASE = JUZ_AMMA.map(
  (surah) => `WHEN r.surah_number = ${surah.number} THEN ${surah.pages}`
).join(" ");

const RECITATION_PAGES = `
  CASE
    ${SURAH_PAGES_CASE}
    WHEN r.type = 'half' THEN 0.5
    WHEN r.type = 'more' AND r.to_page IS NOT NULL
      THEN MAX(1, r.to_page - r.page_number + 1)
    ELSE 1
  END
`;

/** تحويل التقييم إلى درجة من 100 لحساب متوسط التسميع. */
const RATING_SCORE = "CASE r.rating WHEN 'excellent' THEN 100 WHEN 'good' THEN 85 ELSE 65 END";

const rangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  halaqaId: z.coerce.number().int().positive().optional(),
});

function rangeClause(q: z.infer<typeof rangeSchema>, dateColumn: string, halaqaColumn: string) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.from) {
    where.push(`${dateColumn} >= ?`);
    params.push(q.from);
  }
  if (q.to) {
    where.push(`${dateColumn} <= ?`);
    params.push(q.to);
  }
  if (q.halaqaId) {
    where.push(`${halaqaColumn} = ?`);
    params.push(q.halaqaId);
  }
  return { where, params };
}

/**
 * GET /api/reports/leaderboard?type=points|attendance|recitation
 * يغذّي صفحة التقارير: نقاط، نسبة حضور، ومتوسط تقييم التسميع لكل طالب.
 */
reportsRouter.get(
  "/leaderboard",
  asyncHandler((req, res) => {
    const q = parse(
      rangeSchema.extend({
        type: z.enum(["points", "attendance", "recitation"]).default("points"),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      req.query
    );

    const params: unknown[] = [];
    const dateFilter = (col: string) => {
      const parts: string[] = [];
      if (q.from) parts.push(`${col} >= ?`);
      if (q.to) parts.push(`${col} <= ?`);
      return parts.length ? ` AND ${parts.join(" AND ")}` : "";
    };
    const pushDates = () => {
      if (q.from) params.push(q.from);
      if (q.to) params.push(q.to);
    };

    // نقاط الفترة (أو الرصيد الكامل إذا لم تُحدَّد فترة)
    const pointsExpr = q.from || q.to ? "COALESCE(pt.total, 0)" : "s.points";

    let sql = `
      SELECT s.id,
             s.name,
             s.avatar_url         AS avatarUrl,
             COALESCE(h.name, '') AS "group",
             ${pointsExpr}        AS points,
             COALESCE(att.rate, 0)      AS attendance,
             COALESCE(att.attended, 0)  AS attendedDays,
             COALESCE(att.total, 0)     AS totalDays,
             COALESCE(rec.pages, 0)     AS recitationPages,
             COALESCE(rec.count, 0)     AS recitationCount
      FROM students s
      LEFT JOIN halaqat h ON h.id = s.halaqa_id
    `;

    if (q.from || q.to) {
      sql += `
        LEFT JOIN (
          SELECT p.student_id, SUM(p.delta) AS total
          FROM point_transactions p
          WHERE 1 = 1${dateFilter("date(p.created_at)")}
          GROUP BY p.student_id
        ) pt ON pt.student_id = s.id
      `;
      pushDates();
    }

    sql += `
      LEFT JOIN (
        SELECT e.student_id,
               -- أيام الحضور (الحاضر والمتأخر) وأيام الدوام المسجَّلة للطالب
               SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
               COUNT(*) AS total,
               ROUND(
                 100.0 * SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END)
                 / COUNT(*)
               ) AS rate
        FROM attendance_entries e
        JOIN attendance_sessions a ON a.id = e.session_id
        WHERE 1 = 1${dateFilter("a.date")}
        GROUP BY e.student_id
      ) att ON att.student_id = s.id
    `;
    pushDates();

    sql += `
      LEFT JOIN (
        SELECT r.student_id,
               ROUND(SUM(${RECITATION_PAGES}), 2) AS pages,
               COUNT(*) AS count
        FROM recitations r
        WHERE 1 = 1${dateFilter("r.recited_at")}
        GROUP BY r.student_id
      ) rec ON rec.student_id = s.id
    `;
    pushDates();

    sql += " WHERE s.is_active = 1";
    if (q.halaqaId) {
      sql += " AND s.halaqa_id = ?";
      params.push(q.halaqaId);
    }

    // المدرّس: لوحة الصدارة تقتصر على طلاب حلقاته
    const scope = halaqaFilter(req.user!, "s.halaqa_id");
    if (scope) {
      sql += ` AND ${scope.sql}`;
      params.push(...scope.params);
    }

    const orderColumn =
      q.type === "points"
        ? "points"
        : q.type === "attendance"
          ? "attendance"
          : "recitationPages";
    sql += ` ORDER BY ${orderColumn} DESC, s.name ASC LIMIT ?`;
    params.push(q.limit);

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];

    res.json({
      data: rows.map((row, index) => ({ ...row, rank: index + 1 })),
      meta: { type: q.type, from: q.from ?? null, to: q.to ?? null },
    });
  })
);

/** GET /api/reports/dashboard — بطاقات الإحصاء في الصفحة الرئيسية. */
reportsRouter.get(
  "/dashboard",
  asyncHandler((req, res) => {
    const { date } = parse(z.object({ date: isoDate.default(() => today()) }), req.query);

    // كل أرقام اللوحة محصورة بنطاق المستخدم: المشرف يرى الكل، والمدرّس حلقاته
    const scopeOn = (column: string) => {
      const filter = halaqaFilter(req.user!, column);
      return {
        clause: filter ? ` AND ${filter.sql}` : "",
        params: filter ? filter.params : [],
      };
    };

    const halaqatScope = scopeOn("id");
    const halaqat = db
      .prepare(`SELECT COUNT(*) AS n FROM halaqat WHERE is_active = 1${halaqatScope.clause}`)
      .get(...halaqatScope.params) as { n: number };

    const studentsScope = scopeOn("halaqa_id");
    const students = db
      .prepare(`SELECT COUNT(*) AS n FROM students WHERE is_active = 1${studentsScope.clause}`)
      .get(...studentsScope.params) as { n: number };

    const attScope = scopeOn("a.halaqa_id");
    const todayAttendance = db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END) AS present
         FROM attendance_entries e
         JOIN attendance_sessions a ON a.id = e.session_id
         WHERE a.date = ?${attScope.clause}`
      )
      .get(date, ...attScope.params) as { total: number; present: number | null };

    const sessionScope = scopeOn("halaqa_id");
    const recordedHalaqat = db
      .prepare(
        `SELECT COUNT(*) AS n FROM attendance_sessions WHERE date = ?${sessionScope.clause}`
      )
      .get(date, ...sessionScope.params) as { n: number };

    const recScope = scopeOn("halaqa_id");
    const recitationsToday = db
      .prepare(`SELECT COUNT(*) AS n FROM recitations WHERE recited_at = ?${recScope.clause}`)
      .get(date, ...recScope.params) as { n: number };

    const actRecScope = scopeOn("r.halaqa_id");
    const actAttScope = scopeOn("a.halaqa_id");
    const activityRows = db
      .prepare(
        `SELECT 'recitation' AS kind, s.name AS student, r.created_at AS at,
                'صفحة ' || r.page_number AS detail, r.surah_number AS surahNumber
         FROM recitations r JOIN students s ON s.id = r.student_id
         WHERE 1 = 1${actRecScope.clause}
         UNION ALL
         SELECT 'attendance' AS kind, COALESCE(h.name, '') AS student, a.created_at AS at,
                'تسجيل حضور ' || a.date AS detail, NULL AS surahNumber
         FROM attendance_sessions a LEFT JOIN halaqat h ON h.id = a.halaqa_id
         WHERE 1 = 1${actAttScope.clause}
         ORDER BY at DESC LIMIT 10`
      )
      .all(...actRecScope.params, ...actAttScope.params) as {
      kind: string;
      student: string;
      at: string;
      detail: string;
      surahNumber: number | null;
    }[];

    // التسميع بالسورة يوصف باسمها لا برقم صفحتها
    const recentActivity = activityRows.map(({ surahNumber, ...row }) => {
      const surah = surahNumber != null ? surahByNumber(surahNumber) : undefined;
      return surah ? { ...row, detail: `سورة ${surah.name}` } : row;
    });

    res.json({
      data: {
        date,
        halaqat: halaqat.n,
        students: students.n,
        halaqatRecordedToday: recordedHalaqat.n,
        attendanceRate: todayAttendance.total
          ? Math.round(((todayAttendance.present ?? 0) / todayAttendance.total) * 100)
          : 0,
        presentToday: todayAttendance.present ?? 0,
        recitationsToday: recitationsToday.n,
        recentActivity,
      },
    });
  })
);

/**
 * GET /api/reports/halaqat/:id/daily?date= — تقرير اليوم لحلقة واحدة.
 *
 * يجمع في نداء واحد ما يحتاجه ملخّص الأهالي: حالة الحضور لكل طالب،
 * وما سمّعه اليوم، ونقاطه المكتسبة في التاريخ نفسه.
 */
reportsRouter.get(
  "/halaqat/:id/daily",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertHalaqaAccess(req.user!, id);

    const { date } = parse(z.object({ date: isoDate.default(() => today()) }), req.query);

    const halaqa = db
      .prepare(
        `SELECT h.id, h.name, COALESCE(u.name,'') AS teacher
         FROM halaqat h LEFT JOIN users u ON u.id = h.teacher_id WHERE h.id = ?`
      )
      .get(id) as { id: number; name: string; teacher: string } | undefined;
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const session = db
      .prepare("SELECT id FROM attendance_sessions WHERE halaqa_id = ? AND date = ?")
      .get(id, date) as { id: number } | undefined;

    // بلا جلسة اليوم تبقى الحالة null: الواجهة تميّز "لم يُسجَّل الحضور بعد"
    // عن "غائب" بدل أن تعلن غياب الجميع.
    const students = db
      .prepare(
        `SELECT s.id,
                s.name,
                e.status,
                (SELECT COALESCE(SUM(pt.delta), 0) FROM point_transactions pt
                  WHERE pt.student_id = s.id AND date(pt.created_at) = ?) AS points,
                (SELECT COALESCE(SUM(pt.delta), 0) FROM point_transactions pt
                  WHERE pt.student_id = s.id AND pt.kind = 'manual'
                    AND date(pt.created_at) = ?) AS participation
         FROM students s
         LEFT JOIN attendance_entries e
           ON e.student_id = s.id AND e.session_id = ?
         WHERE s.halaqa_id = ? AND s.is_active = 1
         ORDER BY s.name`
      )
      .all(date, date, session?.id ?? -1, id) as {
      id: number;
      name: string;
      status: string | null;
      points: number;
      participation: number;
    }[];

    const recitations = db
      .prepare(
        `SELECT r.student_id AS studentId, r.type, r.page_number AS pageNumber,
                r.to_page AS toPage, r.surah_number AS surahNumber, r.rating
         FROM recitations r
         JOIN students s ON s.id = r.student_id
         WHERE s.halaqa_id = ? AND r.recited_at = ?
         ORDER BY r.id`
      )
      .all(id, date) as { studentId: number }[];

    res.json({
      data: {
        halaqa,
        date,
        recorded: Boolean(session),
        students: students.map((student) => ({
          ...student,
          recitations: recitations.filter((r) => r.studentId === student.id),
        })),
      },
    });
  })
);

/** GET /api/reports/halaqat/:id — تقرير حلقة واحدة. */
reportsRouter.get(
  "/halaqat/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertHalaqaAccess(req.user!, id);

    const q = parse(rangeSchema, { ...req.query, halaqaId: id });

    const halaqa = db
      .prepare(
        `SELECT h.id, h.name, COALESCE(u.name,'') AS teacher
         FROM halaqat h LEFT JOIN users u ON u.id = h.teacher_id WHERE h.id = ?`
      )
      .get(id);
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const att = rangeClause(q, "a.date", "a.halaqa_id");
    const attendance = db
      .prepare(
        `SELECT COUNT(DISTINCT a.id) AS sessions,
                COUNT(e.id) AS entries,
                SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN a.teacher_status = 'absent' THEN 1 ELSE 0 END) AS teacherAbsences
         FROM attendance_sessions a
         LEFT JOIN attendance_entries e ON e.session_id = a.id
         WHERE ${att.where.join(" AND ")}`
      )
      .get(...att.params) as {
      sessions: number;
      entries: number;
      present: number | null;
      teacherAbsences: number | null;
    };

    const rec = rangeClause(q, "r.recited_at", "r.halaqa_id");
    const recitations = db
      .prepare(
        `SELECT COUNT(*) AS total,
                ROUND(AVG(${RATING_SCORE})) AS averageScore,
                SUM(CASE WHEN r.rating = 'excellent' THEN 1 ELSE 0 END) AS excellent,
                SUM(CASE WHEN r.rating = 'needs' THEN 1 ELSE 0 END) AS needsImprovement
         FROM recitations r
         WHERE ${rec.where.join(" AND ")}`
      )
      .get(...rec.params);

    res.json({
      data: {
        halaqa,
        range: { from: q.from ?? null, to: q.to ?? null },
        attendance: {
          ...attendance,
          rate: attendance.entries
            ? Math.round(((attendance.present ?? 0) / attendance.entries) * 100)
            : 0,
        },
        recitations,
      },
    });
  })
);

/** GET /api/reports/students/:id — تقرير طالب مفصّل. */
reportsRouter.get(
  "/students/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertStudentAccess(req.user!, id);

    const q = parse(rangeSchema.omit({ halaqaId: true }), req.query);

    const student = db
      .prepare(
        `SELECT s.id, s.code, s.name, s.avatar_url AS avatarUrl, s.points,
                COALESCE(h.name,'') AS halaqa
         FROM students s LEFT JOIN halaqat h ON h.id = s.halaqa_id WHERE s.id = ?`
      )
      .get(id);
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const dates: unknown[] = [];
    let filter = "";
    if (q.from) {
      filter += " AND a.date >= ?";
      dates.push(q.from);
    }
    if (q.to) {
      filter += " AND a.date <= ?";
      dates.push(q.to);
    }

    const attendance = db
      .prepare(
        `SELECT COUNT(*) AS sessions,
                SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
                SUM(CASE WHEN e.status = 'absent' THEN 1 ELSE 0 END) AS absences
         FROM attendance_entries e
         JOIN attendance_sessions a ON a.id = e.session_id
         WHERE e.student_id = ?${filter}`
      )
      .get(id, ...dates) as { sessions: number; attended: number | null; absences: number | null };

    const recDates: unknown[] = [];
    let recFilter = "";
    if (q.from) {
      recFilter += " AND r.recited_at >= ?";
      recDates.push(q.from);
    }
    if (q.to) {
      recFilter += " AND r.recited_at <= ?";
      recDates.push(q.to);
    }

    const recitations = db
      .prepare(
        `SELECT COUNT(*) AS total,
                ROUND(AVG(${RATING_SCORE})) AS averageScore,
                MAX(r.page_number) AS furthestPage,
                MAX(r.recited_at) AS lastDate
         FROM recitations r WHERE r.student_id = ?${recFilter}`
      )
      .get(id, ...recDates);

    const timeline = db
      .prepare(
        `SELECT r.recited_at AS date, r.type, r.page_number AS pageNumber, r.rating
         FROM recitations r WHERE r.student_id = ?${recFilter}
         ORDER BY r.recited_at DESC LIMIT 30`
      )
      .all(id, ...recDates);

    res.json({
      data: {
        student,
        range: { from: q.from ?? null, to: q.to ?? null },
        attendance: {
          ...attendance,
          rate: attendance.sessions
            ? Math.round(((attendance.attended ?? 0) / attendance.sessions) * 100)
            : 0,
        },
        recitations,
        timeline,
      },
    });
  })
);
