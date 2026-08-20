import { Router } from "express";
import { z } from "zod";
import { db, tx } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam } from "../lib/schemas.js";
import { requireRole } from "../middleware/auth.js";
import { applyScope, assertHalaqaAccess } from "../services/scope.js";

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
         h.teacher_id                       AS teacherId,
         COALESCE(u.name, '')               AS teacher,
         h.schedule_time                    AS scheduleTime,
         h.location,
         h.stage,
         h.is_active                        AS isActive,
         (SELECT COUNT(*) FROM students s
           WHERE s.halaqa_id = h.id AND s.is_active = 1) AS students
  FROM halaqat h
  LEFT JOIN users u ON u.id = h.teacher_id
`;

/** توحيد الاسم للمقارنة والتخزين: تُقصّ الأطراف وتُجمع المسافات المتكررة. */
function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** اسم مكرّر (بعد التوحيد) يربك كل قوائم اختيار الحلقات، فيُرفض. */
function assertNameFree(name: string, exceptId?: number) {
  const target = cleanName(name).toLowerCase();
  const rows = db.prepare("SELECT id, name FROM halaqat").all() as {
    id: number;
    name: string;
  }[];

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
  asyncHandler((req, res) => {
    const { mine, active } = parse(
      z.object({ mine: boolParam.optional(), active: boolParam.default(true) }),
      req.query
    );

    const where: string[] = [];
    const params: unknown[] = [];
    if (active) where.push("h.is_active = 1");
    if (mine) {
      where.push("h.teacher_id = ?");
      params.push(req.user!.id);
    }

    // المدرّس لا يرى إلا حلقاته
    applyScope(req.user!, "h.id", where, params);

    const sql = `${SELECT_HALAQA} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY h.name`;
    res.json({ data: db.prepare(sql).all(...params) });
  })
);

/** GET /api/halaqat/:id */
halaqatRouter.get(
  "/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertHalaqaAccess(req.user!, id);

    const halaqa = db.prepare(`${SELECT_HALAQA} WHERE h.id = ?`).get(id);
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");
    res.json({ data: halaqa });
  })
);

/** GET /api/halaqat/:id/students — طلاب الحلقة مع آخر تسميع (شكل StudentCard). */
halaqatRouter.get(
  "/:id/students",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    assertHalaqaAccess(req.user!, id);

    const exists = db.prepare("SELECT 1 FROM halaqat WHERE id = ?").get(id);
    if (!exists) throw ApiError.notFound("الحلقة غير موجودة");

    const data = db
      .prepare(
        `SELECT s.id,
                s.code,
                s.name,
                s.points,
                s.avatar_url AS avatarUrl,
                (SELECT r.recited_at FROM recitations r
                  WHERE r.student_id = s.id
                  ORDER BY r.recited_at DESC, r.id DESC LIMIT 1) AS lastRecitation,
                (SELECT r.page_number FROM recitations r
                  WHERE r.student_id = s.id
                  ORDER BY r.recited_at DESC, r.id DESC LIMIT 1) AS lastPage
         FROM students s
         WHERE s.halaqa_id = ? AND s.is_active = 1
         ORDER BY s.name`
      )
      .all(id);

    res.json({ data });
  })
);

/** POST /api/halaqat */
halaqatRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler((req, res) => {
    const body = parse(halaqaBody, req.body);
    assertNameFree(body.name);

    const info = db
      .prepare(
        `INSERT INTO halaqat (name, teacher_id, stage, schedule_time, location)
         VALUES (@name, @teacher_id, @stage, @schedule_time, @location)`
      )
      .run({
        name: cleanName(body.name),
        teacher_id: body.teacher_id ?? null,
        stage: body.stage ?? null,
        schedule_time: body.schedule_time ?? null,
        location: body.location ?? null,
      });

    res
      .status(201)
      .json({ data: db.prepare(`${SELECT_HALAQA} WHERE h.id = ?`).get(info.lastInsertRowid) });
  })
);

/** PATCH /api/halaqat/:id */
halaqatRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(halaqaBody.partial().extend({ is_active: z.boolean().optional() }), req.body);

    const current = db.prepare("SELECT * FROM halaqat WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!current) throw ApiError.notFound("الحلقة غير موجودة");
    if (body.name !== undefined) assertNameFree(body.name, id);

    db.prepare(
      `UPDATE halaqat
       SET name = @name, teacher_id = @teacher_id, stage = @stage,
           schedule_time = @schedule_time, location = @location, is_active = @is_active
       WHERE id = @id`
    ).run({
      id,
      name: body.name !== undefined ? cleanName(body.name) : current.name,
      teacher_id: body.teacher_id !== undefined ? body.teacher_id : current.teacher_id,
      stage: body.stage !== undefined ? body.stage : current.stage,
      schedule_time:
        body.schedule_time !== undefined ? body.schedule_time : current.schedule_time,
      location: body.location !== undefined ? body.location : current.location,
      is_active: body.is_active !== undefined ? Number(body.is_active) : current.is_active,
    });

    res.json({ data: db.prepare(`${SELECT_HALAQA} WHERE h.id = ?`).get(id) });
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
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const { reassignTo } = parse(
      z.object({ reassignTo: z.coerce.number().int().positive().optional() }),
      req.query
    );

    const halaqa = db.prepare("SELECT id FROM halaqat WHERE id = ?").get(id) as
      | { id: number }
      | undefined;
    if (!halaqa) throw ApiError.notFound("الحلقة غير موجودة");

    const { n: students } = db
      .prepare("SELECT COUNT(*) AS n FROM students WHERE halaqa_id = ? AND is_active = 1")
      .get(id) as { n: number };

    if (students > 0 && reassignTo === undefined) {
      throw new ApiError(
        409,
        `الحلقة فيها ${students} طالباً — اختر حلقة تُنقل إليها قبل التعطيل`,
        { students }
      );
    }

    if (reassignTo !== undefined) {
      if (reassignTo === id) throw ApiError.badRequest("لا يمكن نقل الطلاب إلى الحلقة نفسها");

      const target = db
        .prepare("SELECT id FROM halaqat WHERE id = ? AND is_active = 1")
        .get(reassignTo);
      if (!target) throw ApiError.badRequest("حلقة الوجهة غير موجودة أو معطّلة");
    }

    tx(() => {
      if (reassignTo !== undefined) {
        db.prepare("UPDATE students SET halaqa_id = ? WHERE halaqa_id = ?").run(reassignTo, id);
      }
      db.prepare("DELETE FROM teacher_halaqat WHERE halaqa_id = ?").run(id);
      db.prepare("UPDATE halaqat SET is_active = 0, teacher_id = NULL WHERE id = ?").run(id);
    });

    res.status(204).end();
  })
);
