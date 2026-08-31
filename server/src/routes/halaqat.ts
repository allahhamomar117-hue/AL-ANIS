import { Router } from "express";
import { z } from "zod";
import { db, tx, type SqlParam } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam } from "../lib/schemas.js";
import { requireRole } from "../middleware/auth.js";
import { applyScope, assertHalaqaAccess } from "../services/scope.js";
import { visibleStudent } from "../services/studentSql.js";

export const halaqatRouter = Router();

/**
 * z.coerce.boolean يعتبر "false" نصاً غير فارغ فيصيّره true — وهو ما كان
 * يمنع `active=false` من إظهار الحلقات المعطّلة. نفسّر النص صراحةً.
 */
const boolParam = z.union([z.boolean(), z.enum(["true", "false", "1", "0"])]).transform(
  (value) => (typeof value === "boolean" ? value : value === "true" || value === "1")
);

const SELECT_HALAQA = `
  SELECT h.id,
         h.name,
         h.teacher_id                       AS "teacherId",
         COALESCE(u.name, '')               AS teacher,
         h.schedule_time                    AS "scheduleTime",
         h.location,
         h.stage,
         h.is_active                        AS "isActive",
         (SELECT COUNT(*) FROM students s
           WHERE s.halaqa_id = h.id AND ${visibleStudent("s")}) AS students
  FROM halaqat h
  LEFT JOIN users u ON u.id = h.teacher_id
`;

/** توحيد الاسم للمقارنة والتخزين: تُقصّ الأطراف وتُجمع المسافات المتكررة. */
function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** اسم مكرّر (بعد التوحيد) يربك كل قوائم اختيار الحلقات، فيُرفض. */
async function assertNameFree(name: string, exceptId?: number): Promise<void> {
  const target = cleanName(name).toLowerCase();
  const rows = await db().all<{ id: number; name: string }>("SELECT id, name FROM halaqat");

  const clash = rows.some(
    (row) => row.id !== exceptId && cleanName(row.name).toLowerCase() === target
  );
  if (clash) throw ApiError.conflict("يوجد حلقة بهذا الاسم");
}

/** المرحلة الدراسية للحلقة — القيم مفاتيح ثابتة تُترجَم في الواجهة. */
const halaqaStage = z.enum(["primary", "preparatory", "secondary"]);

const halaqaBody = z.object({
  name: z.string().min(2),
  teacher_id: z.number().int().positive().nullable().optional(),
  stage: halaqaStage.nullable().optional(),
  schedule_time: z.string().max(50).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
});

/** GET /api/halaqat — قائمة الحلقات مع عدد الطلاب (شكل HalaqaCard). */
halaqatRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { mine, active } = parse(
      z.object({ mine: boolParam.optional(), active: boolParam.default(true) }),
      req.query
    );

    const where: string[] = [];
    const params: SqlParam[] = [];
    if (active) where.push("h.is_active = TRUE");
    if (mine) {
      where.push("h.teacher_id = ?");
      params.push(req.user!.id);
    }

    // المدرّس لا يرى إلا حلقاته
    await applyScope(req.user!, "h.id", where, params);

    const sql = `${SELECT_HALAQA} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY h.name`;
    res.json({ data: await db().all(sql, params) });
  })
);

/** GET /api/halaqat/:id */
halaqatRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertHalaqaAccess(req.user!, id);

    const halaqa = await db().get(`${SELECT_HALAQA} WHERE h.id = ?`, [id]);
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");
    res.json({ data: halaqa });
  })
);

/** GET /api/halaqat/:id/students — طلاب الحلقة مع آخر تسميع (شكل StudentCard). */
halaqatRouter.get(
  "/:id/students",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    await assertHalaqaAccess(req.user!, id);

    const exists = await db().get("SELECT 1 FROM halaqat WHERE id = ?", [id]);
    if (!exists) throw ApiError.notFound("الحلقة غير موجودة");

    const data = await db().all(
      `SELECT s.id,
              s.code,
              s.name,
              s.points,
              s.avatar_url AS "avatarUrl",
              (SELECT r.recited_at FROM recitations r
                WHERE r.student_id = s.id
                ORDER BY r.recited_at DESC, r.id DESC LIMIT 1) AS "lastRecitation",
              (SELECT r.page_number FROM recitations r
                WHERE r.student_id = s.id
                ORDER BY r.recited_at DESC, r.id DESC LIMIT 1) AS "lastPage"
       FROM students s
       WHERE s.halaqa_id = ? AND ${visibleStudent("s")}
       ORDER BY s.name`,
      [id]
    );

    res.json({ data });
  })
);

/** POST /api/halaqat */
halaqatRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = parse(halaqaBody, req.body);
    await assertNameFree(body.name);

    const info = await db().run(
      `INSERT INTO halaqat (name, teacher_id, stage, schedule_time, location)
       VALUES (?, ?, ?, ?, ?)`,
      [
        cleanName(body.name),
        body.teacher_id ?? null,
        body.stage ?? null,
        body.schedule_time ?? null,
        body.location ?? null,
      ]
    );

    res.status(201).json({
      data: await db().get(`${SELECT_HALAQA} WHERE h.id = ?`, [info.lastInsertRowid]),
    });
  })
);

/** PATCH /api/halaqat/:id */
halaqatRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(
      halaqaBody.partial().extend({ is_active: z.boolean().optional() }),
      req.body
    );

    const current = await db().get<Record<string, SqlParam>>(
      "SELECT * FROM halaqat WHERE id = ?",
      [id]
    );
    if (!current) throw ApiError.notFound("الحلقة غير موجودة");
    if (body.name !== undefined) await assertNameFree(body.name, id);

    await db().run(
      `UPDATE halaqat
       SET name = ?, teacher_id = ?, stage = ?,
           schedule_time = ?, location = ?, is_active = ?
       WHERE id = ?`,
      [
        body.name !== undefined ? cleanName(body.name) : current.name,
        body.teacher_id !== undefined ? body.teacher_id : current.teacher_id,
        body.stage !== undefined ? body.stage : current.stage,
        body.schedule_time !== undefined ? body.schedule_time : current.schedule_time,
        body.location !== undefined ? body.location : current.location,
        // منطقيّ صريح: عمود Postgres من نوع boolean لا يقبل 0/1
        body.is_active !== undefined ? body.is_active : Boolean(current.is_active),
        id,
      ]
    );

    res.json({ data: await db().get(`${SELECT_HALAQA} WHERE h.id = ?`, [id]) });
  })
);

/**
 * DELETE /api/halaqat/:id — تعطيل لا حذف فعلي (السجلات التاريخية تبقى مرتبطة).
 *
 * الحلقة التي فيها طلاب فعّالون لا تُعطَّل صامتة: إمّا أن يمرّر المدير
 * `?reassignTo=<id>` فيُنقل الطلاب إليها، وإمّا يُرَدّ 409 بعددهم.
 * روابط الأساتذة تُفكّ دائماً حتى لا يبقى نطاق مفتوح على حلقة معطّلة.
 */
halaqatRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { reassignTo } = parse(
      z.object({ reassignTo: z.coerce.number().int().positive().optional() }),
      req.query
    );

    const halaqa = await db().get<{ id: number }>("SELECT id FROM halaqat WHERE id = ?", [id]);
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    // المؤرشفون لا يُحسبون: تعطيل الحلقة لا يستدعي نقل من أنهى دورته
    const counted = await db().get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM students WHERE halaqa_id = ? AND ${visibleStudent("")}`,
      [id]
    );
    const students = counted?.n ?? 0;

    if (students > 0 && reassignTo === undefined) {
      throw new ApiError(
        409,
        `الحلقة فيها ${students} طالباً — اختر حلقة تُنقل إليها قبل التعطيل`,
        { students }
      );
    }

    if (reassignTo !== undefined) {
      if (reassignTo === id) throw ApiError.badRequest("لا يمكن نقل الطلاب إلى الحلقة نفسها");

      const target = await db().get(
        "SELECT id FROM halaqat WHERE id = ? AND is_active = TRUE",
        [reassignTo]
      );
      if (!target) throw ApiError.badRequest("حلقة الوجهة غير موجودة أو معطّلة");
    }

    await tx(async () => {
      if (reassignTo !== undefined) {
        await db().run("UPDATE students SET halaqa_id = ? WHERE halaqa_id = ?", [
          reassignTo,
          id,
        ]);
      }
      await db().run("DELETE FROM teacher_halaqat WHERE halaqa_id = ?", [id]);
      await db().run("UPDATE halaqat SET is_active = FALSE, teacher_id = NULL WHERE id = ?", [
        id,
      ]);
    });

    res.status(204).end();
  })
);
