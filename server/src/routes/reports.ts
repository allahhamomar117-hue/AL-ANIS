import { Router } from "express";
import { z } from "zod";
import { db, type SqlParam } from "../db/index.js";
import { dateOf } from "../db/sqlfn.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam, isoDate, today } from "../lib/schemas.js";
import { denySupervisor } from "../middleware/auth.js";
import { assertHalaqaAccess, assertStudentAccess, halaqaFilter } from "../services/scope.js";
import { surahByNumber } from "../lib/surahs.js";
import { recitationPagesExpr } from "../services/recitationSql.js";
import { visibleStudent } from "../services/studentSql.js";

export const reportsRouter = Router();

/** تحويل التقييم إلى درجة من 100 لحساب متوسط التسميع. */
const RATING_SCORE = "CASE r.rating WHEN 'excellent' THEN 100 WHEN 'good' THEN 85 ELSE 65 END";

const rangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  halaqaId: z.coerce.number().int().positive().optional(),
});

function rangeClause(q: z.infer<typeof rangeSchema>, dateColumn: string, halaqaColumn: string) {
  const where: string[] = [];
  const params: SqlParam[] = [];
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
  // بلا أي شرط يبقى WHERE معلّقاً بلا تعبير، فنضع شرطاً محايداً
  if (where.length === 0) where.push("1 = 1");
  return { where, params };
}

/**
 * GET /api/reports/leaderboard?type=points|attendance|recitation
 * يغذّي صفحة التقارير: نقاط، نسبة حضور، ومتوسط تقييم التسميع لكل طالب.
 */
reportsRouter.get(
  "/leaderboard",
  denySupervisor,
  asyncHandler(async (req, res) => {
    const q = parse(
      rangeSchema.extend({
        type: z.enum(["points", "attendance", "recitation"]).default("points"),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      req.query
    );

    const params: SqlParam[] = [];
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
             s.avatar_url         AS "avatarUrl",
             COALESCE(h.name, '') AS "group",
             ${pointsExpr}        AS points,
             COALESCE(att.rate, 0)      AS attendance,
             COALESCE(att.attended, 0)  AS "attendedDays",
             COALESCE(att.total, 0)     AS "totalDays",
             COALESCE(rec.pages, 0)     AS "recitationPages",
             COALESCE(rec.count, 0)     AS "recitationCount"
      FROM students s
      LEFT JOIN halaqat h ON h.id = s.halaqa_id
    `;

    if (q.from || q.to) {
      sql += `
        LEFT JOIN (
          SELECT p.student_id, SUM(p.delta) AS total
          FROM point_transactions p
          WHERE 1 = 1${dateFilter(dateOf("p.created_at"))}
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

    // CAST إلى numeric: ROUND ذات المنزلتين لا تقبل double في Postgres،
    // والمجموع هنا كسريّ (نصف صفحة = 0.5).
    sql += `
      LEFT JOIN (
        SELECT r.student_id,
               ROUND(CAST(SUM(${recitationPagesExpr()}) AS numeric), 2) AS pages,
               COUNT(*) AS count
        FROM recitations r
        WHERE 1 = 1${dateFilter("r.recited_at")}
        GROUP BY r.student_id
      ) rec ON rec.student_id = s.id
    `;
    pushDates();

    // لوحة الصدارة تخصّ الدورة الجارية: المؤرشف لا يزاحم من يسمّع اليوم
    sql += ` WHERE ${visibleStudent("s")}`;
    if (q.halaqaId) {
      sql += " AND s.halaqa_id = ?";
      params.push(q.halaqaId);
    }

    // المدرّس: لوحة الصدارة تقتصر على طلاب حلقاته
    const scope = await halaqaFilter(req.user!, "s.halaqa_id");
    if (scope) {
      sql += ` AND ${scope.sql}`;
      params.push(...scope.params);
    }

    /*
     * الاسم مقتبس هنا كما في SELECT.
     *
     * "recitationPages" مُعرَّف باقتباس فوق (وإلّا طواه Postgres إلى حروف
     * صغيرة وضاع على الواجهة)، فالإشارة إليه بلا اقتباس تُطوى هي الأخرى
     * فلا يجد المُحرّك عموداً بهذا الاسم. الاسمان الآخران بحروف صغيرة
     * أصلاً، والاقتباس لا يضرّهما.
     */
    const orderColumn =
      q.type === "points"
        ? "points"
        : q.type === "attendance"
          ? "attendance"
          : "recitationPages";
    sql += ` ORDER BY "${orderColumn}" DESC, s.name ASC LIMIT ?`;
    params.push(q.limit);

    const rows = await db().all<Record<string, unknown>>(sql, params);

    res.json({
      data: rows.map((row, index) => ({ ...row, rank: index + 1 })),
      meta: { type: q.type, from: q.from ?? null, to: q.to ?? null },
    });
  })
);

/** GET /api/reports/dashboard — بطاقات الإحصاء في الصفحة الرئيسية. */
reportsRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const { date } = parse(z.object({ date: isoDate.default(() => today()) }), req.query);

    // كل أرقام اللوحة محصورة بنطاق المستخدم: المشرف يرى الكل، والمدرّس حلقاته
    const scopeOn = async (column: string) => {
      const filter = await halaqaFilter(req.user!, column);
      return {
        clause: filter ? ` AND ${filter.sql}` : "",
        params: filter ? (filter.params as SqlParam[]) : [],
      };
    };

    /*
     * بطاقات الإحصاء العامة محجوبة عن المشرف: دوره المتابعة اليومية.
     * لا تُحسب أرقامها ولا تُرسَل — فالإخفاء في الواجهة ليس شكلياً.
     * آخر النشاطات تبقى للجميع: هي متابعة تشغيلية لا إحصاء.
     */
    const stats =
      req.user!.role === "SUPERVISOR"
        ? null
        : await (async () => {
          const halaqatScope = await scopeOn("id");
          const halaqat = await db().get<{ n: number }>(
            `SELECT COUNT(*) AS n FROM halaqat WHERE is_active = TRUE${halaqatScope.clause}`,
            halaqatScope.params
          );

          const studentsScope = await scopeOn("halaqa_id");
          const students = await db().get<{ n: number }>(
            `SELECT COUNT(*) AS n FROM students WHERE ${visibleStudent("")}${studentsScope.clause}`,
            studentsScope.params
          );

          const attScope = await scopeOn("a.halaqa_id");
          const todayAttendance = await db().get<{ total: number; present: number | null }>(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END) AS present
             FROM attendance_entries e
             JOIN attendance_sessions a ON a.id = e.session_id
             WHERE a.date = ?${attScope.clause}`,
            [date, ...attScope.params]
          );

          const sessionScope = await scopeOn("halaqa_id");
          const recordedHalaqat = await db().get<{ n: number }>(
            `SELECT COUNT(*) AS n FROM attendance_sessions WHERE date = ?${sessionScope.clause}`,
            [date, ...sessionScope.params]
          );

          const recScope = await scopeOn("halaqa_id");
          const recitationsToday = await db().get<{ n: number }>(
            `SELECT COUNT(*) AS n FROM recitations WHERE recited_at = ?${recScope.clause}`,
            [date, ...recScope.params]
          );
          const attendanceTotal = todayAttendance?.total ?? 0;
          const attendancePresent = todayAttendance?.present ?? 0;

          return {
            halaqat: halaqat?.n ?? 0,
            students: students?.n ?? 0,
            halaqatRecordedToday: recordedHalaqat?.n ?? 0,
            attendanceRate: attendanceTotal
              ? Math.round((attendancePresent / attendanceTotal) * 100)
              : 0,
            presentToday: attendancePresent,
            recitationsToday: recitationsToday?.n ?? 0,
          };
        })();

    const actRecScope = await scopeOn("r.halaqa_id");
    const actAttScope = await scopeOn("a.halaqa_id");
    const activityRows = await db().all<{
      kind: string;
      student: string;
      at: string;
      detail: string;
      surahNumber: number | null;
    }>(
      `SELECT 'recitation' AS kind, s.name AS student, r.created_at AS at,
              'صفحة ' || r.page_number AS detail, r.surah_number AS "surahNumber"
       FROM recitations r JOIN students s ON s.id = r.student_id
       WHERE 1 = 1${actRecScope.clause}
       UNION ALL
       SELECT 'attendance' AS kind, COALESCE(h.name, '') AS student, a.created_at AS at,
              'تسجيل حضور ' || a.date AS detail, NULL AS "surahNumber"
       FROM attendance_sessions a LEFT JOIN halaqat h ON h.id = a.halaqa_id
       WHERE 1 = 1${actAttScope.clause}
       ORDER BY at DESC LIMIT 10`,
      [...actRecScope.params, ...actAttScope.params]
    );

    // التسميع بالسورة يوصف باسمها لا برقم صفحتها
    const recentActivity = activityRows.map(({ surahNumber, ...row }) => {
      const surah = surahNumber != null ? surahByNumber(surahNumber) : undefined;
      return surah ? { ...row, detail: `سورة ${surah.name}` } : row;
    });

    res.json({
      data: {
        date,
        ...(stats ?? {}),
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
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertHalaqaAccess(req.user!, id);

    const { date } = parse(z.object({ date: isoDate.default(() => today()) }), req.query);

    const halaqa = await db().get<{ id: number; name: string; teacher: string }>(
      `SELECT h.id, h.name, COALESCE(u.name,'') AS teacher
       FROM halaqat h LEFT JOIN users u ON u.id = h.teacher_id WHERE h.id = ?`,
      [id]
    );
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const session = await db().get<{ id: number }>(
      "SELECT id FROM attendance_sessions WHERE halaqa_id = ? AND date = ?",
      [id, date]
    );

    // بلا جلسة اليوم تبقى الحالة null: الواجهة تميّز "لم يُسجَّل الحضور بعد"
    // عن "غائب" بدل أن تعلن غياب الجميع.
    const students = await db().all<{
      id: number;
      name: string;
      status: string | null;
      points: number;
      participation: number;
    }>(
      `SELECT s.id,
              s.name,
              e.status,
              (SELECT COALESCE(SUM(pt.delta), 0) FROM point_transactions pt
                WHERE pt.student_id = s.id AND ${dateOf("pt.created_at")} = ?) AS points,
              (SELECT COALESCE(SUM(pt.delta), 0) FROM point_transactions pt
                WHERE pt.student_id = s.id AND pt.kind = 'manual'
                  AND ${dateOf("pt.created_at")} = ?) AS participation
       FROM students s
       LEFT JOIN attendance_entries e
         ON e.student_id = s.id AND e.session_id = ?
       WHERE s.halaqa_id = ? AND ${visibleStudent("s")}
       ORDER BY s.name`,
      [date, date, session?.id ?? -1, id]
    );

    const recitations = await db().all<{ studentId: number }>(
      `SELECT r.student_id AS "studentId", r.type, r.page_number AS "pageNumber",
              r.to_page AS "toPage", r.surah_number AS "surahNumber", r.rating
       FROM recitations r
       JOIN students s ON s.id = r.student_id
       WHERE s.halaqa_id = ? AND r.recited_at = ?
       ORDER BY r.id`,
      [id, date]
    );

    // حركات النقاط اليدوية بأسبابها: المجموع وحده كان يصل إلى الأهالي
    // رقماً بلا تفسير، و"‏+10" بلا سبب لا يقول شيئاً لوليّ الأمر.
    const manualPoints = await db().all<{
      studentId: number;
      delta: number;
      reason: string | null;
    }>(
      `SELECT pt.student_id AS "studentId", pt.delta, pt.reason
       FROM point_transactions pt
       JOIN students s ON s.id = pt.student_id
       WHERE s.halaqa_id = ? AND pt.kind = 'manual'
         AND ${dateOf("pt.created_at")} = ?
       ORDER BY pt.id`,
      [id, date]
    );

    res.json({
      data: {
        halaqa,
        date,
        recorded: Boolean(session),
        students: students.map((student) => ({
          ...student,
          recitations: recitations.filter((r) => r.studentId === student.id),
          participationEntries: manualPoints.filter((p) => p.studentId === student.id),
        })),
      },
    });
  })
);

/** GET /api/reports/halaqat/:id — تقرير حلقة واحدة. */
reportsRouter.get(
  "/halaqat/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertHalaqaAccess(req.user!, id);

    const q = parse(rangeSchema, { ...req.query, halaqaId: id });

    const halaqa = await db().get(
      `SELECT h.id, h.name, COALESCE(u.name,'') AS teacher
       FROM halaqat h LEFT JOIN users u ON u.id = h.teacher_id WHERE h.id = ?`,
      [id]
    );
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const att = rangeClause(q, "a.date", "a.halaqa_id");
    const attendance = await db().get<{
      sessions: number;
      entries: number;
      present: number | null;
      teacherAbsences: number | null;
    }>(
      `SELECT COUNT(DISTINCT a.id) AS sessions,
              COUNT(e.id) AS entries,
              SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END) AS present,
              SUM(CASE WHEN a.teacher_status = 'absent' THEN 1 ELSE 0 END) AS "teacherAbsences"
       FROM attendance_sessions a
       LEFT JOIN attendance_entries e ON e.session_id = a.id
       WHERE ${att.where.join(" AND ")}`,
      att.params
    );

    const rec = rangeClause(q, "r.recited_at", "r.halaqa_id");
    const recitations = await db().get(
      `SELECT COUNT(*) AS total,
              ROUND(AVG(${RATING_SCORE})) AS "averageScore",
              SUM(CASE WHEN r.rating = 'excellent' THEN 1 ELSE 0 END) AS excellent,
              SUM(CASE WHEN r.rating = 'needs' THEN 1 ELSE 0 END) AS "needsImprovement"
       FROM recitations r
       WHERE ${rec.where.join(" AND ")}`,
      rec.params
    );

    const entries = attendance?.entries ?? 0;

    res.json({
      data: {
        halaqa,
        range: { from: q.from ?? null, to: q.to ?? null },
        attendance: {
          ...attendance,
          rate: entries ? Math.round(((attendance?.present ?? 0) / entries) * 100) : 0,
        },
        recitations,
      },
    });
  })
);

/** GET /api/reports/students/:id — تقرير طالب مفصّل. */
reportsRouter.get(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertStudentAccess(req.user!, id);

    const q = parse(rangeSchema.omit({ halaqaId: true }), req.query);

    const student = await db().get(
      `SELECT s.id, s.code, s.name, s.avatar_url AS "avatarUrl", s.points,
              COALESCE(h.name,'') AS halaqa
       FROM students s LEFT JOIN halaqat h ON h.id = s.halaqa_id WHERE s.id = ?`,
      [id]
    );
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const dates: SqlParam[] = [];
    let filter = "";
    if (q.from) {
      filter += " AND a.date >= ?";
      dates.push(q.from);
    }
    if (q.to) {
      filter += " AND a.date <= ?";
      dates.push(q.to);
    }

    const attendance = await db().get<{
      sessions: number;
      attended: number | null;
      absences: number | null;
    }>(
      `SELECT COUNT(*) AS sessions,
              SUM(CASE WHEN e.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
              SUM(CASE WHEN e.status = 'absent' THEN 1 ELSE 0 END) AS absences
       FROM attendance_entries e
       JOIN attendance_sessions a ON a.id = e.session_id
       WHERE e.student_id = ?${filter}`,
      [id, ...dates]
    );

    const recDates: SqlParam[] = [];
    let recFilter = "";
    if (q.from) {
      recFilter += " AND r.recited_at >= ?";
      recDates.push(q.from);
    }
    if (q.to) {
      recFilter += " AND r.recited_at <= ?";
      recDates.push(q.to);
    }

    const recitations = await db().get(
      `SELECT COUNT(*) AS total,
              ROUND(AVG(${RATING_SCORE})) AS "averageScore",
              MAX(r.page_number) AS "furthestPage",
              MAX(r.recited_at) AS "lastDate"
       FROM recitations r WHERE r.student_id = ?${recFilter}`,
      [id, ...recDates]
    );

    const timeline = await db().all(
      `SELECT r.recited_at AS date, r.type, r.page_number AS "pageNumber", r.rating
       FROM recitations r WHERE r.student_id = ?${recFilter}
       ORDER BY r.recited_at DESC LIMIT 30`,
      [id, ...recDates]
    );

    const sessions = attendance?.sessions ?? 0;

    res.json({
      data: {
        student,
        range: { from: q.from ?? null, to: q.to ?? null },
        attendance: {
          ...attendance,
          rate: sessions ? Math.round(((attendance?.attended ?? 0) / sessions) * 100) : 0,
        },
        recitations,
        timeline,
      },
    });
  })
);
