import { Router } from "express";
import { z } from "zod";
import { db, tx, type SqlParam } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { SURAH_FIRST, SURAH_LAST, surahByNumber } from "../lib/surahs.js";
import {
  idParam,
  isoDate,
  pagination,
  rating,
  recitationType,
  today,
  type Rating,
  type RecitationType,
} from "../lib/schemas.js";
import { addPoints, recitationPoints, revertPointsFor } from "../services/points.js";
import { applyScope, assertHalaqaAccess, assertStudentAccess } from "../services/scope.js";

export const recitationsRouter = Router();

/**
 * صفّ جدول recitations بأسماء أعمدته الخام — لقراءات `SELECT *`.
 *
 * الردود المُرسَلة إلى الواجهة تُسمّى بأسلوب camelCase عبر SELECT_RECITATION،
 * أمّا هذا فصورة الصفّ كما هو في القاعدة، يُستعمل داخلياً عند التعديل.
 *
 * page_completed عدد لا منطقيّ: السائق يعيد المنطقيات 0/1 حفاظاً على
 * العقد القائم مع الواجهة، فيُحوَّل صراحةً عند الحاجة.
 */
interface RecitationRow {
  id: number;
  student_id: number;
  halaqa_id: number | null;
  type: RecitationType;
  page_number: number;
  to_page: number | null;
  verse: number | null;
  page_completed: number;
  surah_number: number | null;
  rating: Rating;
  notes: string | null;
  recited_at: string;
}

const SELECT_RECITATION = `
  SELECT r.id,
         r.student_id            AS "studentId",
         s.name                  AS "studentName",
         s.avatar_url            AS "studentAvatarUrl",
         r.halaqa_id             AS "halaqaId",
         COALESCE(h.name, '')    AS halaqa,
         r.type,
         r.page_number           AS "pageNumber",
         r.to_page               AS "toPage",
         r.verse,
         r.page_completed        AS "pageCompleted",
         r.surah_number          AS "surahNumber",
         r.rating,
         r.notes,
         r.recited_at            AS "recitedAt",
         COALESCE(u.name, '')    AS "recordedBy",
         r.created_at            AS "createdAt"
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
    surahNumber: z.number().int().min(SURAH_FIRST).max(SURAH_LAST).nullable().optional(),
    pageNumber: z.number().int().min(1).max(604).optional(),
    toPage: z.number().int().min(1).max(604).nullable().optional(),
    verse: z.number().int().min(1).nullable().optional(),
    pageCompleted: z.boolean().default(false),
    /** التقييم الافتراضي «ممتاز» حين لا يرسله العميل. */
    rating: rating.default("excellent"),
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
  asyncHandler(async (req, res) => {
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
    const params: SqlParam[] = [];
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
    await applyScope(req.user!, "r.halaqa_id", where, params);

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const counted = await db().get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM recitations r ${clause}`,
      params
    );
    const total = counted?.n ?? 0;

    const data = await db().all(
      `${SELECT_RECITATION} ${clause} ORDER BY r.recited_at DESC, r.id DESC LIMIT ? OFFSET ?`,
      [...params, q.limit, q.offset]
    );

    res.json({ data, meta: { total, limit: q.limit, offset: q.offset } });
  })
);

/** GET /api/recitations/:id */
recitationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const row = await db().get<{ studentId: number }>(`${SELECT_RECITATION} WHERE r.id = ?`, [
      id,
    ]);
    if (!row) throw ApiError.notFound("سجل التلاوة غير موجود");
    await assertStudentAccess(req.user!, row.studentId);
    res.json({ data: row });
  })
);

/** POST /api/recitations — تسجيل تلاوة/تسميع ومنح النقاط بحسب التقييم. */
recitationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parse(recitationBody, req.body);

    const student = await db().get<{ id: number; halaqaId: number | null }>(
      `SELECT id, halaqa_id AS "halaqaId" FROM students WHERE id = ? AND is_active = TRUE`,
      [body.studentId]
    );
    if (!student) throw ApiError.notFound("الطالب غير موجود");

    /*
     * الحلقة تُشتقّ من الطالب لا من جسم الطلب.
     *
     * الواجهة ترسل halaqaId من رابط الصفحة (groupId)، وهو قد يتخلّف عن
     * الواقع إن نُقل الطالب أو فُتحت الصفحة من سياق حلقة أخرى. تقديم قيمة
     * العميل كان يُنتج عطبين: رفض 403 بحجّة "الحلقة خارج نطاقك" في وجه
     * أستاذٍ يملك الطالب فعلاً، وقيدُ تسميعٍ تحت حلقة لا ينتمي إليها الطالب
     * فتختلّ تقاريرها. حلقة الطالب هي المرجع، وقيمة العميل احتياط فقط حين
     * لا يكون الطالب مسنَداً إلى حلقة.
     */
    const halaqaId = student.halaqaId ?? body.halaqaId ?? null;

    // الطالب والحلقة المستهدفة كلاهما يجب أن يكونا ضمن نطاق المستخدم
    await assertStudentAccess(req.user!, body.studentId);
    await assertHalaqaAccess(req.user!, halaqaId);

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

    const id = await tx(async () => {
      const info = await db().run(
        `INSERT INTO recitations
           (student_id, halaqa_id, type, page_number, to_page, verse, page_completed,
            surah_number, rating, notes, recited_at, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.studentId,
          halaqaId,
          body.type,
          pageNumber,
          toPage,
          surah ? null : body.type === "half" ? body.verse! : null,
          // منطقيّ صريح: عمود Postgres من نوع boolean لا يقبل 0/1
          surah ? true : body.type === "half" ? body.pageCompleted : true,
          body.surahNumber ?? null,
          body.rating,
          body.notes ?? null,
          body.recitedAt,
          req.user!.id,
        ]
      );

      const recitationId = info.lastInsertRowid;

      await addPoints({
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

    res.status(201).json({
      data: await db().get(`${SELECT_RECITATION} WHERE r.id = ?`, [id]),
    });
  })
);

/** PATCH /api/recitations/:id — يعيد احتساب النقاط عند تغيير التقييم. */
recitationsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const current = await db().get<RecitationRow>(
      "SELECT * FROM recitations WHERE id = ?",
      [id]
    );
    if (!current) throw ApiError.notFound("سجل التلاوة غير موجود");
    await assertStudentAccess(req.user!, current.student_id);

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

    await tx(async () => {
      await db().run(
        `UPDATE recitations SET
           type = ?, page_number = ?, to_page = ?, verse = ?,
           page_completed = ?, rating = ?, notes = ?,
           recited_at = ?
         WHERE id = ?`,
        [
          // سجل مرتبط بسورة يبقى نوعه 'surah' مهما أُرسل
          current.surah_number != null ? "surah" : (body.type ?? current.type),
          body.pageNumber ?? current.page_number,
          body.toPage !== undefined ? body.toPage : current.to_page,
          body.verse !== undefined ? body.verse : current.verse,
          // منطقيّ صريح: القيمة المقروءة تعود 0/1 فتُحوَّل قبل الكتابة
          body.pageCompleted !== undefined
            ? body.pageCompleted
            : Boolean(current.page_completed),
          body.rating ?? current.rating,
          body.notes !== undefined ? body.notes : current.notes,
          body.recitedAt ?? current.recited_at,
          id,
        ]
      );

      // النقاط تتبع التقييم والمقدار معاً، فأي تغيّر في أيّهما يوجب إعادة الاحتساب
      const next = await db().get<RecitationRow>(
        "SELECT * FROM recitations WHERE id = ?",
        [id]
      );

      const affectsPoints =
        next!.rating !== current.rating ||
        next!.type !== current.type ||
        next!.page_number !== current.page_number ||
        next!.to_page !== current.to_page;

      if (affectsPoints) {
        await revertPointsFor("recitation", id);
        await addPoints({
          studentId: current.student_id,
          delta: recitationPoints({
            rating: next!.rating,
            type: next!.type,
            pageNumber: next!.page_number,
            toPage: next!.to_page,
            surahNumber: next!.surah_number,
          }),
          reason: "تعديل التسميع",
          kind: "recitation",
          referenceId: id,
          createdBy: req.user!.id,
        });
      }
    });

    res.json({ data: await db().get(`${SELECT_RECITATION} WHERE r.id = ?`, [id]) });
  })
);

/** DELETE /api/recitations/:id */
recitationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);

    const existing = await db().get<{ studentId: number }>(
      `SELECT student_id AS "studentId" FROM recitations WHERE id = ?`,
      [id]
    );
    if (!existing) throw ApiError.notFound("سجل التلاوة غير موجود");
    await assertStudentAccess(req.user!, existing.studentId);

    const info = await tx(async () => {
      await revertPointsFor("recitation", id);
      return db().run("DELETE FROM recitations WHERE id = ?", [id]);
    });

    if (info.changes === 0) throw ApiError.notFound("سجل التلاوة غير موجود");
    res.status(204).end();
  })
);
