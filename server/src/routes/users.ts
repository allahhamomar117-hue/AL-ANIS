import { Router } from "express";
import { z } from "zod";
import { db, tx, type SqlParam } from "../db/index.js";
import { groupConcat } from "../db/sqlfn.js";
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

/**
 * دالة لا ثابت: دمج أسماء الحلقات يختلف بين اللهجتين
 * (‏GROUP_CONCAT مقابل string_agg) واللهجة لا تُعرف إلا بعد فتح الاتصال.
 */
const selectUser = (): string => `
  SELECT u.id, u.name, u.username, u.role, u.is_active AS "isActive",
         u.created_at AS "createdAt",
         (u.password_hash IS NOT NULL) AS "hasPassword",
         (SELECT COUNT(*) FROM halaqat h
           WHERE h.is_active = TRUE
             AND (h.teacher_id = u.id
                  OR EXISTS (SELECT 1 FROM teacher_halaqat th
                              WHERE th.user_id = u.id AND th.halaqa_id = h.id))
         ) AS "halaqatCount",
         (SELECT ${groupConcat("h.name", "، ")} FROM halaqat h
           WHERE h.is_active = TRUE
             AND (h.teacher_id = u.id
                  OR EXISTS (SELECT 1 FROM teacher_halaqat th
                              WHERE th.user_id = u.id AND th.halaqa_id = h.id))
         ) AS "halaqatNames"
  FROM users u
`;

const byId = (id: number) => db().get(`${selectUser()} WHERE u.id = ?`, [id]);

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
async function syncUserHalaqat(userId: number, halaqaIds: number[]): Promise<void> {
  const wanted = [...new Set(halaqaIds)];

  await db().run("DELETE FROM teacher_halaqat WHERE user_id = ?", [userId]);

  for (const halaqaId of wanted) {
    await db().run(
      `INSERT INTO teacher_halaqat (user_id, halaqa_id) VALUES (?, ?)
       ON CONFLICT (user_id, halaqa_id) DO NOTHING`,
      [userId, halaqaId]
    );
  }

  const keep = wanted.length ? `AND id NOT IN (${wanted.map(() => "?").join(", ")})` : "";
  await db().run(`UPDATE halaqat SET teacher_id = NULL WHERE teacher_id = ? ${keep}`, [
    userId,
    ...wanted,
  ]);
}

/** عدد المديرين الفاعلين — لمنع فقدان آخر حساب قادر على إدارة الحسابات. */
async function activeAdminCount(): Promise<number> {
  const row = await db().get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'ADMIN' AND is_active = TRUE"
  );
  return row?.n ?? 0;
}

/** يرمي 409 إذا كان اسم المستخدم محجوزاً (الفهرس فريد، لكن الرسالة أوضح من هنا). */
async function assertUsernameFree(username: string, exceptId?: number): Promise<void> {
  const row = await db().get<{ id: number }>("SELECT id FROM users WHERE username = ?", [
    username,
  ]);
  if (row && row.id !== exceptId) throw ApiError.conflict("اسم المستخدم محجوز");
}

/** GET /api/users?role=TEACHER&includeInactive=1 — دليل الكادر. */
usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        role: userRole.optional(),
        includeInactive: z.coerce.boolean().default(false),
      }),
      req.query
    );

    const where: string[] = [];
    const params: SqlParam[] = [];
    if (!q.includeInactive) where.push("u.is_active = TRUE");
    if (q.role) {
      where.push("u.role = ?");
      params.push(q.role);
    }

    const sql = `${selectUser()}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY CASE u.role WHEN 'ADMIN' THEN 0 WHEN 'SUPERVISOR' THEN 1 ELSE 2 END, u.name`;

    res.json({ data: await db().all(sql, params) });
  })
);

/**
 * POST /api/users — إنشاء حساب أستاذ أو مشرف.
 * اسم المستخدم وكلمة المرور مطلوبان: الحساب المُنشأ من هنا يُستعمل للدخول فوراً.
 */
usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(2),
        username: z.string().trim().min(3),
        password: z.string().min(4),
        role: userRole.default("TEACHER"),
        halaqaIds: z.array(z.number().int().positive()).default([]),
      }),
      req.body
    );

    await assertUsernameFree(body.username);

    const created = await tx(async () => {
      const info = await db().run(
        // بلا هاتف: العمود يقبل NULL منذ ترقية 006، وكل NULL مميّز في
        // القاعدتين فلا يتضارب مع القيد الفريد (country_code, phone_number).
        `INSERT INTO users (name, username, password_hash, role)
         VALUES (?, ?, ?, ?)`,
        [body.name, body.username, hashPassword(body.password), body.role]
      );

      for (const halaqaId of body.halaqaIds ?? []) {
        await db().run(
          `INSERT INTO teacher_halaqat (user_id, halaqa_id) VALUES (?, ?)
           ON CONFLICT (user_id, halaqa_id) DO NOTHING`,
          [info.lastInsertRowid, halaqaId]
        );
      }

      return byId(info.lastInsertRowid);
    });

    res.status(201).json({ data: created });
  })
);

/** GET /api/users/:id/halaqat — الحلقات المسندة إلى مستخدم. */
usersRouter.get(
  "/:id/halaqat",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);

    const data = await db().all(
      `SELECT h.id, h.name, (h.teacher_id = ?) AS "isPrimary"
       FROM halaqat h
       WHERE h.teacher_id = ?
          OR EXISTS (SELECT 1 FROM teacher_halaqat th
                      WHERE th.user_id = ? AND th.halaqa_id = h.id)
       ORDER BY h.name`,
      [id, id, id]
    );

    res.json({ data });
  })
);

/**
 * PUT /api/users/:id/halaqat — ضبط الحلقات المسندة (استبدال كامل).
 * الحلقة التي هو أستاذها الأساسي تبقى ضمن نطاقه دائماً.
 */
usersRouter.put(
  "/:id/halaqat",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { halaqaIds } = parse(
      z.object({ halaqaIds: z.array(z.number().int().positive()) }),
      req.body
    );

    const user = await db().get<{ id: number }>("SELECT id FROM users WHERE id = ?", [id]);
    if (!user) throw ApiError.notFound("المستخدم غير موجود");

    await tx(() => syncUserHalaqat(id, halaqaIds));

    res.json({
      data: await db().all(
        `SELECT h.id, h.name FROM halaqat h
         JOIN teacher_halaqat th ON th.halaqa_id = h.id
         WHERE th.user_id = ? ORDER BY h.name`,
        [id]
      ),
    });
  })
);

/**
 * PATCH /api/users/:id — تعديل حساب: الاسم، اسم الدخول، كلمة المرور،
 * الدور، التفعيل، والحلقات المسندة.
 */
usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(
      z.object({
        name: z.string().trim().min(2).optional(),
        username: z.string().trim().min(3).optional(),
        password: z.string().min(4).optional(),
        role: userRole.optional(),
        is_active: z.boolean().optional(),
        halaqaIds: z.array(z.number().int().positive()).optional(),
      }),
      req.body
    );

    const current = await db().get<{
      id: number;
      name: string;
      username: string | null;
      password_hash: string | null;
      phone_number: string | null;
      role: string;
      is_active: number;
    }>("SELECT * FROM users WHERE id = ?", [id]);
    if (!current) throw ApiError.notFound("المستخدم غير موجود");

    if (body.username) await assertUsernameFree(body.username, id);

    const nextRole = body.role ?? current.role;
    // منطقيّ صريح: عمود Postgres من نوع boolean لا يقبل 0/1
    const nextActive =
      body.is_active !== undefined ? body.is_active : Boolean(current.is_active);

    // لا يجوز إفراغ المنظومة من المديرين: آخر مدير فاعل لا يُخفَّض ولا يُعطَّل.
    const losesAdmin = current.role === "ADMIN" && (nextRole !== "ADMIN" || !nextActive);
    if (losesAdmin && (await activeAdminCount()) <= 1) {
      throw ApiError.badRequest("لا يمكن إزالة آخر حساب مدير");
    }

    // المدير لا يسحب صلاحيته من نفسه بالخطأ فيفقد الوصول إلى هذه الصفحة
    if (req.user!.id === id && (nextRole !== "ADMIN" || !nextActive)) {
      throw ApiError.badRequest("لا يمكنك تعديل دور حسابك أو تعطيله");
    }

    await tx(async () => {
      await db().run(
        `UPDATE users
            SET name = ?, username = ?, password_hash = ?,
                role = ?, is_active = ?
          WHERE id = ?`,
        [
          body.name ?? current.name,
          body.username ?? current.username,
          body.password ? hashPassword(body.password) : current.password_hash,
          nextRole,
          nextActive,
          id,
        ]
      );

      // القائمة المرسلة هي الحالة النهائية للنطاق، لا إضافة عليه
      if (body.halaqaIds) await syncUserHalaqat(id, body.halaqaIds);
    });

    res.json({ data: await byId(id) });
  })
);

/**
 * PUT /api/users/:id/password — تعيين كلمة مرور جديدة للحساب.
 *
 * مسار مستقل عن PATCH: تغيير كلمة المرور عملية حسّاسة بذاتها، وفصلها
 * يمنع تمريرها ضمناً مع تعديل الاسم أو الدور، ويسمح بحدّ أدنى أشدّ
 * (ثمانية أحرف) دون كسر الحسابات القديمة المُنشأة بأربعة.
 *
 * لا يُعاد أي أثر لكلمة المرور في الاستجابة — الخادم لا يعيد التجزئة أبداً.
 */
usersRouter.put(
  "/:id/password",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);
    const { password } = parse(
      z.object({ password: z.string().min(8, "كلمة المرور ثمانية أحرف على الأقل") }),
      req.body
    );

    const current = await db().get<{ id: number }>("SELECT id FROM users WHERE id = ?", [id]);
    if (!current) throw ApiError.notFound("المستخدم غير موجود");

    await db().run("UPDATE users SET password_hash = ? WHERE id = ?", [
      hashPassword(password),
      id,
    ]);

    res.json({ data: await byId(id) });
  })
);

/** DELETE /api/users/:id — تعطيل الحساب (لا حذف فعلي، حفاظاً على السجلات). */
usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parse(idParam, req.params.id);

    const current = await db().get<{ id: number; role: string }>(
      "SELECT id, role FROM users WHERE id = ?",
      [id]
    );
    if (!current) throw ApiError.notFound("المستخدم غير موجود");

    if (req.user!.id === id) throw ApiError.badRequest("لا يمكنك تعطيل حسابك");
    if (current.role === "ADMIN" && (await activeAdminCount()) <= 1) {
      throw ApiError.badRequest("لا يمكن إزالة آخر حساب مدير");
    }

    await db().run("UPDATE users SET is_active = FALSE WHERE id = ?", [id]);
    res.json({ data: await byId(id) });
  })
);
