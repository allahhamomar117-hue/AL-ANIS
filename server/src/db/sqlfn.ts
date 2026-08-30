/**
 * شذرات SQL تختلف بين SQLite و Postgres.
 *
 * أغلب استعلامات المشروع محمولة كما هي: `?` تُترجَم في السائق،
 * و`ON CONFLICT … DO UPDATE/NOTHING` و`TRUE/FALSE` يفهمها الاثنان
 * (‏SQLite منذ 3.24 و 3.23 على الترتيب). ما تبقّى مجموعٌ هنا في مكان
 * واحد بدل أن يتناثر شرطُ لهجةٍ في كل مسار.
 */
import { db } from "./driver.js";

/**
 * دمج نصوص عمود في سلسلة واحدة بفاصل.
 *   SQLite   : GROUP_CONCAT(expr, sep)
 *   Postgres : string_agg(expr, sep)
 */
export function groupConcat(expr: string, separator: string): string {
  const sep = `'${separator.replace(/'/g, "''")}'`;
  return db().dialect === "postgres"
    ? `string_agg(${expr}, ${sep})`
    : `GROUP_CONCAT(${expr}, ${sep})`;
}

/**
 * اقتطاع الجزء اليوميّ من طابع زمني للمقارنة مع 'YYYY-MM-DD'.
 *   SQLite   : date(expr)   — الطوابع نصوص
 *   Postgres : expr::date   — لا توجد دالة date() تقبل timestamp
 */
export function dateOf(expr: string): string {
  return db().dialect === "postgres" ? `(${expr})::date` : `date(${expr})`;
}

/**
 * الوقت الحالي كطابع زمني.
 *   SQLite   : datetime('now')
 *   Postgres : now()
 */
export function nowExpr(): string {
  return db().dialect === "postgres" ? "now()" : "datetime('now')";
}

/**
 * أكبر قيمتين قياسيّتين (لا تجميع).
 *   SQLite   : MAX(a, b)  — نسختها القياسية تقبل وسيطين
 *   Postgres : GREATEST(a, b) — MAX فيه دالة تجميع فقط
 *
 * الخلط بينهما يُنتج خطأ "aggregate function calls cannot be nested"
 * في Postgres لا نتيجة خاطئة، فالمشكلة تظهر عند أول تقرير.
 */
export function greatest(a: string, b: string): string {
  return db().dialect === "postgres" ? `GREATEST(${a}, ${b})` : `MAX(${a}, ${b})`;
}

/**
 * الوقت الحالي مضافاً إليه دقائق (صلاحية رمز التحقق).
 *   SQLite   : datetime('now', '+10 minutes')
 *   Postgres : now() + interval '10 minutes'
 *
 * العدد يُدرَج في النصّ لا كمعامل، فيجب أن يبقى عدداً صحيحاً من الكود
 * لا من إدخال المستخدم.
 */
export function nowPlusMinutes(minutes: number): string {
  const n = Math.trunc(minutes);
  return db().dialect === "postgres"
    ? `now() + interval '${n} minutes'`
    : `datetime('now', '+${n} minutes')`;
}

/**
 * الشهر من تاريخ بصيغة 'YYYY-MM' — للتجميع الشهري في الإحصاءات.
 *   SQLite   : strftime('%Y-%m', expr) — التواريخ نصوص
 *   Postgres : to_char(expr::date, 'YYYY-MM')
 *
 * التحويل الصريح إلى date ليس زينة: to_char لا تملك صيغةً تقبل نصّاً
 * معاملاً أوّل، فإن كان العمود text سقط الاستعلام بـ
 * "function to_char(text, unknown) does not exist" — وهو ما حدث فعلاً على
 * قاعدة الإنتاج، إذ جاء recited_at فيها نصّاً لا date كما يصفه
 * schema.pg.sql (انحراف في قاعدة أُنشئت قبل الملف الحالي).
 *
 * التحويل يعمل في الحالتين: نصّ 'YYYY-MM-DD' يُحوَّل إلى date، وعمود date
 * يمرّ بلا أثر — فلا يعود الاستعلام رهيناً بنوع العمود في كل قاعدة.
 *
 * ويُعاد استعمال dateOf لا يُكتب تحويل ثانٍ، ليبقى شكل التحويل في موضع
 * واحد إن تغيّر يوماً.
 */
export function monthOf(expr: string): string {
  return db().dialect === "postgres"
    ? `to_char(${dateOf(expr)}, 'YYYY-MM')`
    : `strftime('%Y-%m', ${expr})`;
}
