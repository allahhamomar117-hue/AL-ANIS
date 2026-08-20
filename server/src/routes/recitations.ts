import { Router } from "express";
import { z } from "zod";
import { db, tx } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { JUZ_AMMA_FIRST, JUZ_AMMA_LAST, surahByNumber } from "../lib/juzAmma.js";
import { idParam, isoDate, pagination, rating, recitationType, today } from "../lib/schemas.js";
import { addPoints, recitationPoints, revertPointsFor } from "../services/points.js";
import { applyScope, assertHalaqaAccess, assertStudentAccess } from "../services/scope.js";

export const recitationsRouter = Router();

const SELECT_RECITATION = `
  SELECT r.id,
         r.student_id            AS studentId,
         s.name                  AS studentName,
         s.avatar_url            AS studentAvatarUrl,
         r.halaqa_id             AS halaqaId,
         COALESCE(h.name, '')    AS halaqa,
         r.type,
         r.page_number           AS pageNumber,
         r.to_page               AS toPage,
         r.verse,
         r.page_completed        AS pageCompleted,
         r.surah_number          AS surahNumber,
         r.rating,
         r.notes,
         r.recited_at            AS recitedAt,
         COALESCE(u.name, '')    AS recordedBy,
         r.created_at            AS createdAt
  FROM recitations r
  JOIN students s ON s.id = r.student_id
  LEFT JOIN halaqat h ON h.id = r.halaqa_id
  LEFT JOIN users u ON u.id = r.recorded_by
`;

/**
 * نفس حِمل شاشة RecitationRegistration، مع تحقق مشروط بحسب النوع:
 * half يتطلب الآية، more يتطلب صفحة النهاية أكبر من البداية.
 */
const recitationBody = z
  .object({
    studentId: z.number().int().positive(),
    halaqaId: z.number().int().positive().optional(),
    type: recitationType,
    /**
     * رقم السورة عند التسميع بالسور (جزء عمّ). عند إرساله تُشتَقّ الصفحات
     * منه ويصبح pageNumber اختيارياً، فالعميل لا يحتاج جدول صفحات المصحف.
     */
    surahNumber: z.number().int().min(JUZ_AMMA_FIRST).max(JUZ_AMMA_LAST).nullable().optional(),
    pageNumber: z.number().int().min(1).max(604).optional(),
    toPage: z.number().int().min(1).max(604).nullable().optional(),
    verse: z.number().int().min(1).nullable().optional(),
    pageCompleted: z.boolean().default(false),
    rating,
    notes: z.string().max(1000).nullable().optional(),
    recitedAt: isoDate.default(() => today()),
  })
  .superRefine((data, ctx) => {
    // إمّا سورة وإمّا صفحة — أحدهما مطلوب
    if (data.surahNumber == null && data.pageNumber == null) {
      ctx.addIssue({ code: "custom", path: ["pageNumber"], message: "رقم الصفحة مطلوب" });
      return;
    }
    // النوع والسورة متلازمان: 'surah' يعني رقم سورة، ورقم السورة يعني 'surah'
    if (data.surahNumber != null && data.type !== "surah") {
      ctx.addIssue({ code: "custom", path: ["type"], message: "نوع التسميع بالسورة يجب أن يكون surah" });
      return;
    }
    if (data.type === "surah" && data.surahNumber == null) {
      ctx.addIssue({ code: "custom", path: ["surahNumber"], message: "رقم السورة مطلوب" });
      return;
    }
    // مع السورة تُشتَقّ الصفحات تلقائياً، فلا معنى لشروط الصفحات
    if (data.surahNumber != null) return;

    // مضمون هنا بعد الفحص أعلاه
    const from = data.pageNumber!;

    if (data.type === "more") {
      if (data.toPage == null) {
        ctx.addIssue({ code: "custom", path: ["toPage"], message: "صفحة النهاية مطلوبة" });
      } else if (data.toPage < from) {
        ctx.addIssue({
          code: "custom",
          path: ["toPage"],
          message: "صفحة النهاية يجب أن تكون بعد صفحة البداية",
        });
      }
    }
    if (data.type === "half" && data.verse == null) {
      ctx.addIssue({ code: "custom", path: ["verse"], message: "رقم الآية مطلوب" });
    }
  });

/** GET /api/recitations?studentId=&halaqaId=&from=&to= — سجل التلاوة. */
recitationsRouter.get(
  "/",
  asyncHandler((req, res) => {
    const q = parse(
      pagination.extend({
        studentId: z.coerce.number().int().positive().optional(),
        halaqaId: z.coerce.number().int().positive().optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
        rating: rating.optional(),
      }),
      req.query
    );

    const where: string[] = [];
    const params: unknown[] = [];
    if (q.studentId) {
      where.push("r.student_id = ?");
      params.push(q.studentId);
    }
    if (q.halaqaId) {
      where.push("r.halaqa_id = ?");
      params.push(q.halaqaId);
    }
    if (q.from) {
      where.push("r.recited_at >= ?");
      params.push(q.from);
    }
    if (q.to) {
      where.push("r.recited_at <= ?");
      params.push(q.to);
    }
    if (q.rating) {
      where.push("r.rating = ?");
      params.push(q.rating);
    }

    // المدرّس لا يرى إلا تلاوات حلقاته
    applyScope(req.user!, "r.halaqa_id", where, params);

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const total = (
      db.prepare(`SELECT COUNT(*) AS n FROM recitations r ${clause}`).get(...params) as {
        n: number;
      }
    ).n;

    const data = db
      .prepare(
        `${SELECT_RECITATION} ${clause} ORDER BY r.recited_at DESC, r.id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, q.limit, q.offset);

    res.json({ data, meta: { total, limit: q.limit, offset: q.offset } });
  })
);

/** GET /api/recitations/:id */
recitationsRouter.get(
  "/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const row = db.prepare(`${SELECT_RECITATION} WHERE r.id = ?`).get(id) as
      | { studentId: number }
      | undefined;
    if (!row) throw ApiError.notFound("سجل التلاوة غير موجود");
    assertStudentAccess(req.user!, row.studentId);
    res.json({ data: row });
  })
);

/** POST /api/recitations — تسجيل تلاوة/تسميع ومنح النقاط بحسب التقييم. */
recitationsRouter.post(
  "/",
  asyncHandler((req, res) => {
    const body = parse(recitationBody, req.body);

    const student = db
      .prepare("SELECT id, halaqa_id AS halaqaId FROM students WHERE id = ? AND is_active = 1")
      .get(body.studentId) as { id: number; halaqaId: number | null } | undefined;
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    const halaqaId = body.halaqaId ?? student.halaqaId;
    // الطالب والحلقة المستهدفة كلاهما يجب أن يكونا ضمن نطاق المستخدم
    assertStudentAccess(req.user!, body.studentId);
    assertHalaqaAccess(req.user!, halaqaId);

    // التسميع بالسورة يُخزَّن بصفحاته أيضاً، فتبقى التقارير القائمة على الصفحات صالحة
    const surah = body.surahNumber != null ? surahByNumber(body.surahNumber) : undefined;
    if (body.surahNumber != null && !surah) {
      throw ApiError.badRequest("السورة خارج جزء عمّ");
    }

    const pageNumber = surah ? surah.startPage : body.pageNumber!;
    const toPage = surah
      ? surah.endPage > surah.startPage
        ? surah.endPage
        : null
      : body.type === "more"
        ? body.toPage!
        : null;

    const id = tx(() => {
      const info = db
        .prepare(
          `INSERT INTO recitations
             (student_id, halaqa_id, type, page_number, to_page, verse, page_completed,
              surah_number, rating, notes, recited_at, recorded_by)
           VALUES
             (@studentId, @halaqaId, @type, @pageNumber, @toPage, @verse, @pageCompleted,
              @surahNumber, @rating, @notes, @recitedAt, @recordedBy)`
        )
        .run({
          studentId: body.studentId,
          halaqaId,
          type: body.type,
          pageNumber,
          toPage,
          verse: surah ? null : body.type === "half" ? body.verse! : null,
          pageCompleted: Number(surah ? true : body.type === "half" ? body.pageCompleted : true),
          surahNumber: body.surahNumber ?? null,
          rating: body.rating,
          notes: body.notes ?? null,
          recitedAt: body.recitedAt,
          recordedBy: req.user!.id,
        });

      const recitationId = Number(info.lastInsertRowid);

      addPoints({
        studentId: body.studentId,
        delta: recitationPoints({
          rating: body.rating,
          type: body.type,
          pageNumber,
          toPage,
          surahNumber: body.surahNumber,
        }),
        reason: surah ? `تسميع سورة ${surah.name}` : `تسميع صفحة ${pageNumber}`,
        kind: "recitation",
        referenceId: recitationId,
        createdBy: req.user!.id,
      });

      return recitationId;
    });

    res.status(201).json({ data: db.prepare(`${SELECT_RECITATION} WHERE r.id = ?`).get(id) });
  })
);

/** PATCH /api/recitations/:id — يعيد احتساب النقاط عند تغيير التقييم. */
recitationsRouter.patch(
  "/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const current = db.prepare("SELECT * FROM recitations WHERE id = ?").get(id) as
      | Record<string, any>
      | undefined;
    if (!current) throw ApiError.notFound("سجل التلاوة غير موجود");
    assertStudentAccess(req.user!, current.student_id);

    const body = parse(
      z.object({
        type: recitationType.optional(),
        pageNumber: z.number().int().min(1).max(604).optional(),
        toPage: z.number().int().min(1).max(604).nullable().optional(),
        verse: z.number().int().min(1).nullable().optional(),
        pageCompleted: z.boolean().optional(),
        rating: rating.optional(),
        notes: z.string().max(1000).nullable().optional(),
        recitedAt: isoDate.optional(),
      }),
      req.body
    );

    tx(() => {
      db.prepare(
        `UPDATE recitations SET
           type = @type, page_number = @pageNumber, to_page = @toPage, verse = @verse,
           page_completed = @pageCompleted, rating = @rating, notes = @notes,
           recited_at = @recitedAt
         WHERE id = @id`
      ).run({
        id,
        // سجل مرتبط بسورة يبقى نوعه 'surah' مهما أُرسل
        type: current.surah_number != null ? "surah" : (body.type ?? current.type),
        pageNumber: body.pageNumber ?? current.page_number,
        toPage: body.toPage !== undefined ? body.toPage : current.to_page,
        verse: body.verse !== undefined ? body.verse : current.verse,
        pageCompleted:
          body.pageCompleted !== undefined
            ? Number(body.pageCompleted)
            : current.page_completed,
        rating: body.rating ?? current.rating,
        notes: body.notes !== undefined ? body.notes : current.notes,
        recitedAt: body.recitedAt ?? current.recited_at,
      });

      // النقاط تتبع التقييم والمقدار معاً، فأي تغيّر في أيّهما يوجب إعادة الاحتساب
      const next = db.prepare("SELECT * FROM recitations WHERE id = ?").get(id) as Record<
        string,
        any
      >;

      const affectsPoints =
        next.rating !== current.rating ||
        next.type !== current.type ||
        next.page_number !== current.page_number ||
        next.to_page !== current.to_page;

      if (affectsPoints) {
        revertPointsFor("recitation", id);
        addPoints({
          studentId: current.student_id,
          delta: recitationPoints({
            rating: next.rating,
            type: next.type,
            pageNumber: next.page_number,
            toPage: next.to_page,
            surahNumber: next.surah_number,
          }),
          reason: "تعديل التسميع",
          kind: "recitation",
          referenceId: id,
          createdBy: req.user!.id,
        });
      }
    });

    res.json({ data: db.prepare(`${SELECT_RECITATION} WHERE r.id = ?`).get(id) });
  })
);

/** DELETE /api/recitations/:id */
recitationsRouter.delete(
  "/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);

    const existing = db.prepare("SELECT student_id AS studentId FROM recitations WHERE id = ?").get(id) as
      | { studentId: number }
      | undefined;
    if (!existing) throw ApiError.notFound("سجل التلاوة غير موجود");
    assertStudentAccess(req.user!, existing.studentId);

    const info = tx(() => {
      revertPointsFor("recitation", id);
      return db.prepare("DELETE FROM recitations WHERE id = ?").run(id);
    });

    if (info.changes === 0) throw ApiError.notFound("سجل التلاوة غير موجود");
    res.status(204).end();
  })
);
