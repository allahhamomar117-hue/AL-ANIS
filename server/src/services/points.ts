import { config } from "../config.js";
import { db } from "../db/index.js";
import { surahByNumber } from "../lib/surahs.js";
import type { RecitationType, Rating } from "../lib/schemas.js";

export type PointKind = "manual" | "attendance" | "recitation" | "adjustment";

export interface PointEntry {
  studentId: number;
  delta: number;
  reason?: string | null;
  kind?: PointKind;
  referenceId?: number | null;
  createdBy?: number | null;
}

/**
 * يقيّد حركة نقاط ويحدّث رصيد الطالب.
 * يجب استدعاؤها داخل معاملة عند ربطها بعملية أخرى (حضور/تسميع).
 */
/**
 * يقيّد حركة نقاط ويحدّث رصيد الطالب.
 * يجب استدعاؤها داخل معاملة عند ربطها بعملية أخرى (حضور/تسميع).
 */
export async function addPoints(entry: PointEntry): Promise<number> {
  const info = await db().run(
    `INSERT INTO point_transactions (student_id, delta, reason, kind, reference_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.studentId,
      entry.delta,
      entry.reason ?? null,
      entry.kind ?? "manual",
      entry.referenceId ?? null,
      entry.createdBy ?? null,
    ]
  );

  await db().run("UPDATE students SET points = points + ? WHERE id = ?", [
    entry.delta,
    entry.studentId,
  ]);

  return info.lastInsertRowid;
}

/**
 * يحذف حركات مرتبطة بسجل معيّن ويعيد النقاط (يُستخدم عند تعديل حضور أو تلاوة).
 */
export async function revertPointsFor(
  kind: PointKind,
  referenceId: number
): Promise<void> {
  const rows = await db().all<{ studentId: number; delta: number }>(
    `SELECT student_id AS "studentId", delta FROM point_transactions WHERE kind = ? AND reference_id = ?`,
    [kind, referenceId]
  );

  for (const row of rows) {
    await db().run("UPDATE students SET points = points - ? WHERE id = ?", [
      row.delta,
      row.studentId,
    ]);
  }

  await db().run(
    "DELETE FROM point_transactions WHERE kind = ? AND reference_id = ?",
    [kind, referenceId]
  );
}

/** يعيد حساب رصيد كل الطلاب من سجل الحركات (أداة صيانة). */
export async function recalculateAllBalances(): Promise<void> {
  await db().exec(`
    UPDATE students
    SET points = COALESCE(
      (SELECT SUM(delta) FROM point_transactions WHERE student_id = students.id), 0
    )
  `);
}

/**
 * عدد الصفحات التي يعادلها تسميع واحد — وهو معامل النسبة في حساب النقاط.
 *
 * - السورة  : وزنها في `surahs.ts`، وهو كسر للسور القصيرة (الناس ≈ 0.18)
 *             حتى لا تساوي صفحةً كاملة، وعدد صفحات للسور الطويلة.
 * - full    : صفحة كاملة → ×1 بالضبط.
 * - half    : نصف صفحة (نوع لم يعد في الواجهة، ويبقى للسجلات القديمة).
 * - more    : عدد الصفحات من البداية إلى النهاية شاملاً الطرفين.
 */
export function recitationPages(input: {
  type: RecitationType;
  pageNumber: number;
  toPage?: number | null;
  surahNumber?: number | null;
}): number {
  if (input.surahNumber != null) {
    return surahByNumber(input.surahNumber)?.pages ?? 1;
  }

  if (input.type === "half") return 0.5;

  if (input.type === "more" && input.toPage != null) {
    return Math.max(1, input.toPage - input.pageNumber + 1);
  }

  return 1;
}

/**
 * نقاط التسميع = (نقاط التقييم لكل صفحة) × (حجم المُسمَّع بالصفحات).
 *
 * نقاط التقييم لكل صفحة كاملة: ممتاز 30، جيد 25، وسط 20 (قابلة للضبط
 * بمتغيّرات البيئة). فالصفحة الكاملة تُضرب بـ1، وسورة تعادل ربع صفحة
 * بتقييم ممتاز = 0.25 × 30 ≈ 8 نقاط.
 *
 * الحدّ الأدنى `recitationMin` يمنع أن يخرج تسميع بصفر نقطة بعد التقريب،
 * ولا يكسر التناسب إلا في السور الأصغر من ذلك الحدّ.
 */
export function recitationPoints(input: {
  rating: Rating;
  type: RecitationType;
  pageNumber: number;
  toPage?: number | null;
  surahNumber?: number | null;
}): number {
  const perPage = config.pointRules.recitation[input.rating];
  const total = Math.round(perPage * recitationPages(input));
  return Math.max(config.pointRules.recitationMin, total);
}
