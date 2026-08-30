/**
 * عدد صفحات التلاوة الواحدة محسوباً داخل SQL.
 *
 * نظير recitationPages في services/points.ts بالضبط، لكن للتجميع في
 * القاعدة بدل الحساب صفّاً صفّاً في جافاسكربت: السورة بوزنها في جزء عمّ
 * (سور كثيرة تتقاسم الصفحة الواحدة)، نصف الصفحة 0.5، والمدى بعدد صفحاته
 * شاملاً الطرفين، وما عداه صفحة واحدة.
 *
 * مصدر الحقيقة للأوزان هو JUZ_AMMA وحده، فلا يوجد جدول أوزان ثانٍ
 * يمكن أن ينحرف عنه.
 *
 * يفترض أن جدول recitations مُسمّى `r` في الاستعلام المستدعي.
 */
import { greatest } from "../db/sqlfn.js";
import { JUZ_AMMA } from "../lib/surahs.js";

const SURAH_PAGES_CASE = JUZ_AMMA.map(
  (surah) => `WHEN r.surah_number = ${surah.number} THEN ${surah.pages}`
).join(" ");

/** دالة لا ثابت: `greatest` تحتاج معرفة اللهجة، وهي لا تُعرف قبل الاتصال. */
export function recitationPagesExpr(): string {
  return `
  CASE
    ${SURAH_PAGES_CASE}
    WHEN r.type = 'half' THEN 0.5
    WHEN r.type = 'more' AND r.to_page IS NOT NULL
      THEN ${greatest("1", "r.to_page - r.page_number + 1")}
    ELSE 1
  END
`;
}
