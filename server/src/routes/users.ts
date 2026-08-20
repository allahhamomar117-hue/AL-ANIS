import { Router } from "express";
import { z } from "zod";
import { db, tx } from "../db/index.js";
import { ApiError, asyncHandler, parse } from "../lib/http.js";
import { idParam, userRole } from "../lib/schemas.js";
import { requireUserManager } from "../middleware/auth.js";
import { hashPassword } from "../lib/password.js";

export const usersRouter = Router();

/**
 * إدارة حسابات الكادر (أساتذة ومشرفون).
 *
 * كل مسارات هذا الملف محصورة بدور المدير (ADMIN) عبر requireUserManager —
 * هذا هو المكافئ لسياسة RLS على جدول users: المشرف يرى كل بيانات الحلقات
 * والطلاب، لكنه لا ينشئ حساباً ولا يبدّل دوراً ولا يعيد ضبط كلمة مرور.
 */
usersRouter.use(requireUserManager);

const SELECT_USER = `
  SELECT u.id, u.name, u.username, u.phone_number AS phoneNumber,
         u.country_code AS countryCode, u.role, u.is_active AS isActive,
         u.created_at AS createdAt,
         (u.password_hash IS NOT NULL) AS hasPassword,
         (SELECT COUNT(*) FROM halaqat h
           WHERE h.is_active = 1
             AND (h.teacher_id = u.id
                  OR EXISTS (SELECT 1 FROM teacher_halaqat th
                              WHERE th.user_id = u.id AND th.halaqa_id = h.id))
         ) AS halaqatCount,
         (SELECT GROUP_CONCAT(h.name, '، ') FROM halaqat h
           WHERE h.is_active = 1
             AND (h.teacher_id = u.id
                  OR EXISTS (SELECT 1 FROM teacher_halaqat th
                              WHERE th.user_id = u.id AND th.halaqa_id = h.id))
         ) AS halaqatNames
  FROM users u
`;

const byId = (id: number | bigint) => db.prepare(`${SELECT_USER} WHERE u.id = ?`).get(id);

/**
 * مزامنة كاملة لحلقات المستخدم: بعدها يكون نطاقه = القائمة المُرسلة تماماً.
 *
 * النطاق يأتي من مصدرين: جدول الإسناد teacher_halaqat، وكون المستخدم
 * الأستاذ الأساسي للحلقة (halaqat.teacher_id). المزامنة على الأول وحده
 * كانت تُبقي الحلقة الأساسية في نطاقه مهما أُلغي تحديدها، فنعالج الاثنين:
 * ما خرج من القائمة يُنزع منه الإسناد وتُفرَّغ أستاذيته الأساسية،
 * وما بقي يُثبَّت له صفّ إسناد.
 *
 * يجب أن تُستدعى داخل معاملة.
 */
function syncUserHalaqat(userId: number, halaqaIds: number[]): void {
  const wanted = [...new Set(halaqaIds)];

  db.prepare("DELETE FROM teacher_halaqat WHERE user_id = ?").run(userId);

  const insert = db.prepare(
    "INSERT OR IGNORE INTO teacher_halaqat (user_id, halaqa_id) VALUES (?, ?)"
  );
  for (const halaqaId of wanted) insert.run(userId, halaqaId);

  const keep = wanted.length ? `AND id NOT IN (${wanted.map(() => "?").join(", ")})` : "";
  db.prepare(`UPDATE halaqat SET teacher_id = NULL WHERE teacher_id = ? ${keep}`).run(
    userId,
    ...wanted
  );
}

/** عدد المديرين الفاعلين — لمنع فقدان آخر حساب قادر على إدارة الحسابات. */
function activeAdminCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN' AND is_active = 1")
    .get() as { n: number };
  return row.n;
}

/** يرمي 409 إذا كان اسم المستخدم محجوزاً (الفهرس فريد، لكن الرسالة أوضح من هنا). */
function assertUsernameFree(username: string, exceptId?: number): void {
  const row = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as
    | { id: number }
    | undefined;
  if (row && row.id !== exceptId) throw ApiError.conflict("اسم المستخدم محجوز");
}

/** GET /api/users?role=TEACHER&includeInactive=1 — دليل الكادر. */
usersRouter.get(
  "/",
  asyncHandler((req, res) => {
    const q = parse(
      z.object({
        role: userRole.optional(),
        includeInactive: z.coerce.boolean().default(false),
      }),
      req.query
    );

    const where: string[] = [];
    const params: unknown[] = [];
    if (!q.includeInactive) where.push("u.is_active = 1");
    if (q.role) {
      where.push("u.role = ?");
      params.push(q.role);
    }

    const sql = `${SELECT_USER}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY CASE u.role WHEN 'ADMIN' THEN 0 WHEN 'SUPERVISOR' THEN 1 ELSE 2 END, u.name`;

    res.json({ data: db.prepare(sql).all(...params) });
  })
);

/**
 * POST /api/users — إنشاء حساب أستاذ أو مشرف.
 * اسم المستخدم وكلمة المرور مطلوبان: الحساب المُنشأ من هنا يُستعمل للدخول فوراً.
 */
usersRouter.post(
  "/",
  asyncHandler((req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(2),
        username: z.string().trim().min(3),
        password: z.string().min(4),
        phone_number: z.string().trim().min(6).max(20).optional(),
        country_code: z.string().trim().min(1).max(5).default("963"),
        role: userRole.default("TEACHER"),
        halaqaIds: z.array(z.number().int().positive()).default([]),
      }),
      req.body
    );

    assertUsernameFree(body.username);

    // العمود يقبل NULL منذ ترقية 006؛ الحساب بلا هاتف يُخزَّن فارغاً
    // بدل قيمة نائبة، وSQLite يعتبر كل NULL مميّزاً فلا يتضارب مع القيد الفريد.
    const phone = body.phone_number || null;

    const created = tx(() => {
      const info = db
        .prepare(
          `INSERT INTO users (name, username, password_hash, phone_number, country_code, role)
           VALUES (@name, @username, @password_hash, @phone_number, @country_code, @role)`
        )
        .run({
          name: body.name,
          username: body.username,
          password_hash: hashPassword(body.password),
          phone_number: phone,
          country_code: body.country_code,
          role: body.role,
        });

      const insert = db.prepare(
        "INSERT OR IGNORE INTO teacher_halaqat (user_id, halaqa_id) VALUES (?, ?)"
      );
      for (const halaqaId of body.halaqaIds ?? []) insert.run(info.lastInsertRowid, halaqaId);

      return byId(info.lastInsertRowid);
    });

    res.status(201).json({ data: created });
  })
);

/** GET /api/users/:id/halaqat — الحلقات المسندة إلى مستخدم. */
usersRouter.get(
  "/:id/halaqat",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);

    const data = db
      .prepare(
        `SELECT h.id, h.name, (h.teacher_id = ?) AS isPrimary
         FROM halaqat h
         WHERE h.teacher_id = ?
            OR EXISTS (SELECT 1 FROM teacher_halaqat th
                        WHERE th.user_id = ? AND th.halaqa_id = h.id)
         ORDER BY h.name`
      )
      .all(id, id, id);

    res.json({ data });
  })
);

/**
 * PUT /api/users/:id/halaqat — ضبط الحلقات المسندة (استبدال كامل).
 * الحلقة التي هو أستاذها الأساسي تبقى ضمن نطاقه دائماً.
 */
usersRouter.put(
  "/:id/halaqat",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const { halaqaIds } = parse(
      z.object({ halaqaIds: z.array(z.number().int().positive()) }),
      req.body
    );

    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id) as
      | { id: number }
      | undefined;
    if (!user) throw ApiError.notFound("المستخدم غير موجود");

    tx(() => syncUserHalaqat(id, halaqaIds));

    res.json({
      data: db
        .prepare(
          `SELECT h.id, h.name FROM halaqat h
           JOIN teacher_halaqat th ON th.halaqa_id = h.id
           WHERE th.user_id = ? ORDER BY h.name`
        )
        .all(id),
    });
  })
);

/**
 * PATCH /api/users/:id — تعديل حساب: الاسم، اسم الدخول، كلمة المرور،
 * الدور، التفعيل، والحلقات المسندة.
 */
usersRouter.patch(
  "/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(
      z.object({
        name: z.string().trim().min(2).optional(),
        username: z.string().trim().min(3).optional(),
        password: z.string().min(4).optional(),
        phone_number: z.union([z.string().trim().min(6).max(20), z.literal("")]).optional(),
        role: userRole.optional(),
        is_active: z.boolean().optional(),
        halaqaIds: z.array(z.number().int().positive()).optional(),
      }),
      req.body
    );

    const current = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | {
          id: number;
          name: string;
          username: string | null;
          password_hash: string | null;
          phone_number: string | null;
          role: string;
          is_active: number;
        }
      | undefined;
    if (!current) throw ApiError.notFound("المستخدم غير موجود");

    if (body.username) assertUsernameFree(body.username, id);

    const nextRole = body.role ?? current.role;
    const nextActive = body.is_active !== undefined ? Number(body.is_active) : current.is_active;

    // لا يجوز إفراغ المنظومة من المديرين: آخر مدير فاعل لا يُخفَّض ولا يُعطَّل.
    const losesAdmin = current.role === "ADMIN" && (nextRole !== "ADMIN" || nextActive === 0);
    if (losesAdmin && activeAdminCount() <= 1) {
      throw ApiError.badRequest("لا يمكن إزالة آخر حساب مدير");
    }

    // المدير لا يسحب صلاحيته من نفسه بالخطأ فيفقد الوصول إلى هذه الصفحة
    if (req.user!.id === id && (nextRole !== "ADMIN" || nextActive === 0)) {
      throw ApiError.badRequest("لا يمكنك تعديل دور حسابك أو تعطيله");
    }

    tx(() => {
      db.prepare(
        `UPDATE users
            SET name = ?, username = ?, password_hash = ?, phone_number = ?,
                role = ?, is_active = ?
          WHERE id = ?`
      ).run(
        body.name ?? current.name,
        body.username ?? current.username,
        body.password ? hashPassword(body.password) : current.password_hash,
        body.phone_number !== undefined ? body.phone_number || null : current.phone_number,
        nextRole,
        nextActive,
        id
      );

      // القائمة المرسلة هي الحالة النهائية للنطاق، لا إضافة عليه
      if (body.halaqaIds) syncUserHalaqat(id, body.halaqaIds);
    });

    res.json({ data: byId(id) });
  })
);

/** DELETE /api/users/:id — تعطيل الحساب (لا حذف فعلي، حفاظاً على السجلات). */
usersRouter.delete(
  "/:id",
  asyncHandler((req, res) => {
    const id = parse(idParam, req.params.id);

    const current = db.prepare("SELECT id, role FROM users WHERE id = ?").get(id) as
      | { id: number; role: string }
      | undefined;
    if (!current) throw ApiError.notFound("المستخدم غير موجود");

    if (req.user!.id === id) throw ApiError.badRequest("لا يمكنك تعطيل حسابك");
    if (current.role === "ADMIN" && activeAdminCount() <= 1) {
      throw ApiError.badRequest("لا يمكن إزالة آخر حساب مدير");
    }

    db.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(id);
    res.json({ data: byId(id) });
  })
);
