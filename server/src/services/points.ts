import { config } from "../config.js";
import { db } from "../db/index.js";
import { surahByNumber } from "../lib/juzAmma.js";
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
export function addPoints(entry: PointEntry): number {
  const info = db
    .prepare(
      `INSERT INTO point_transactions (student_id, delta, reason, kind, reference_id, created_by)
       VALUES (@studentId, @delta, @reason, @kind, @referenceId, @createdBy)`
    )
    .run({
      studentId: entry.studentId,
      delta: entry.delta,
      reason: entry.reason ?? null,
      kind: entry.kind ?? "manual",
      referenceId: entry.referenceId ?? null,
      createdBy: entry.createdBy ?? null,
    });

  db.prepare("UPDATE students SET points = points + ? WHERE id = ?").run(
    entry.delta,
    entry.studentId
  );

  return Number(info.lastInsertRowid);
}

/**
 * يحذف حركات مرتبطة بسجل معيّن ويعيد النقاط (يُستخدم عند تعديل حضور أو تلاوة).
 */
export function revertPointsFor(kind: PointKind, referenceId: number): void {
  const rows = db
    .prepare(
      "SELECT student_id AS studentId, delta FROM point_transactions WHERE kind = ? AND reference_id = ?"
    )
    .all(kind, referenceId) as { studentId: number; delta: number }[];

  const update = db.prepare("UPDATE students SET points = points - ? WHERE id = ?");
  for (const row of rows) update.run(row.delta, row.studentId);

  db.prepare("DELETE FROM point_transactions WHERE kind = ? AND reference_id = ?").run(
    kind,
    referenceId
  );
}

/** يعيد حساب رصيد كل الطلاب من سجل الحركات (أداة صيانة). */
export function recalculateAllBalances(): void {
  db.exec(`
    UPDATE students
    SET points = COALESCE(
      (SELECT SUM(delta) FROM point_transactions WHERE student_id = students.id), 0
    )
  `);
}

/**
 * عدد الصفحات التي يعادلها تسميع واحد.
 *
 * - السورة  : وزنها المعرّف في جزء عمّ (سور الصفحة الواحدة تتقاسمها).
 * - full    : صفحة كاملة.
 * - half    : نصف صفحة.
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
 * نقاط التسميع = (نقاط التقييم لكل صفحة) × (عدد الصفحات)، بحدّ أدنى.
 * الحدّ الأدنى يمنع أن يخرج تسميع سورة قصيرة بنقطة أو نقطتين.
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
