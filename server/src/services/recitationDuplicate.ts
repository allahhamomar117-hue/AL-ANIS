/**
 * منع تكرار التسميع: ألّا يُمنح الطالب نقاطاً مرّتين على المحتوى نفسه.
 *
 * المطابقة تقاطعية بين السور والصفحات، وهي ممكنة لأن جدول recitations
 * يخزّن الصفحات المشتقّة (page_number / to_page) للتسميع بالسورة أيضاً —
 * راجع الهجرة 003. فمقارنة مدى الصفحات وحدها تكفي لالتقاط «سمّع سورة
 * الناس ثم أراد الأستاذ إدخال الصفحة 604».
 *
 * استثناء واحد ضروري: سور جزء عمّ كثيرة تتقاسم الصفحة الواحدة (الإخلاص
 * والفلق والناس كلّها في 604). لو قارنّا مدى الصفحات بين تسميعَي سورة
 * لصار تسميع الفلق مرفوضاً لأن الناس سُمِّعت — وهذا خطأ. لذلك حين يكون
 * الطرفان سورتين تكون المقارنة برقم السورة لا بالصفحة.
 */
import { db } from "../db/index.js";
import { surahByNumber } from "../lib/surahs.js";

/** مدى صفحات السورة برقمها — دالة المطابقة بين السور والصفحات. */
export function surahPageRange(surahNumber: number): { from: number; to: number } | undefined {
  const surah = surahByNumber(surahNumber);
  return surah ? { from: surah.startPage, to: surah.endPage } : undefined;
}

interface Candidate {
  id: number;
  surahNumber: number | null;
}

/**
 * أول تسميع سابق لهذا الطالب يتقاطع مع المُدخَل الجديد، أو null إن لم يوجد.
 *
 * `excludeId` لاستدعاء التعديل: السجل لا يُطابق نفسه.
 */
export async function findDuplicateRecitation(input: {
  studentId: number;
  /** بداية مدى الصفحات (مشتقّاً من السورة عند التسميع بالسورة). */
  pageNumber: number;
  /** نهاية المدى، أو null إذا كان صفحة واحدة. */
  toPage: number | null;
  surahNumber: number | null;
  excludeId?: number;
}): Promise<number | null> {
  const from = input.pageNumber;
  const to = input.toPage ?? input.pageNumber;

  // تقاطع المديين: بداية كلٍّ منهما قبل نهاية الآخر
  const rows = await db().all<Candidate>(
    `SELECT id, surah_number AS "surahNumber"
       FROM recitations
      WHERE student_id = ?
        AND page_number <= ?
        AND COALESCE(to_page, page_number) >= ?
        AND id <> ?`,
    [input.studentId, to, from, input.excludeId ?? -1]
  );

  for (const row of rows) {
    // سورة مقابل سورة: التطابق برقم السورة لا بالصفحة المشتركة
    if (input.surahNumber != null && row.surahNumber != null) {
      if (row.surahNumber === input.surahNumber) return row.id;
      continue;
    }
    // ما عدا ذلك تقاطع الصفحات كافٍ — وهو ما يربط السورة بصفحتها
    return row.id;
  }

  return null;
}
