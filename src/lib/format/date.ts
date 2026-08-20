/**
 * تنسيق التواريخ والأوقات.
 *
 * يعتمد Intl.DateTimeFormat المدمج في المتصفح — لا مكتبة خارجية ولا جداول
 * أسماء شهور مكتوبة يدوياً.
 *
 * الأرقام لاتينية عمداً (`-u-nu-latn`): الواجهة كلها تعرض أرقام الصفحات
 * والنقاط باللاتينية، فلو صارت التواريخ بالأرقام الهندية (٢٠٢٦) اختلط
 * الشكل في الصفحة الواحدة.
 *
 * ملاحظة مهمة: لا تُدمج تاريخاً ووقتاً في نص واحد يدوياً داخل واجهة RTL.
 * سلسلة مثل "2026-08-20 01:54" يقلبها محرك الاتجاه فتُقرأ "01:54 2026-08-20"،
 * وهي العلّة التي كانت في لوحة آخر النشاطات. استعمل formatDateTime أو
 * اعرض كلاً منهما في عنصر مستقل.
 */

const AR = "ar-EG-u-nu-latn";
const EN = "en-GB";

/** الوسم اللغوي المناسب: يقبل "ar" / "en" أو أي وسم كامل. */
function localeOf(lang?: string): string {
  return lang?.startsWith("en") ? EN : AR;
}

/**
 * يقبل: كائن Date، أو "YYYY-MM-DD"، أو طابعاً زمنياً كاملاً (ISO).
 * التاريخ المجرّد يُفسَّر محلياً لا بتوقيت UTC، وإلا ظهر يوم سابق
 * في المناطق ذات الإزاحة السالبة.
 */
function toDate(value: Date | string): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  // الخادم يخزّن الطوابع بـ datetime('now') وهي بتوقيت UTC بصيغة
  // "YYYY-MM-DD HH:MM:SS" بلا لاحقة منطقة. لو مُرِّرت كما هي فسّرها المتصفح
  // على أنها توقيت محلي، فيظهر الوقت مزاحاً بمقدار فرق المنطقة (ساعتان أو
  // ثلاث). نُلحق Z صراحةً ليُحوَّل إلى التوقيت المحلي تحويلاً صحيحاً.
  const naive = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value);
  const parsed = new Date(naive ? `${value.replace(" ", "T")}Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** `20 أغسطس 2026` — للقوائم والعناوين. */
export function formatDate(value: Date | string | null | undefined, lang?: string): string {
  const date = value == null ? null : toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(localeOf(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** `2026/08/20` — حيث المساحة ضيقة (رؤوس الجداول والبطاقات المدمجة). */
export function formatShortDate(value: Date | string | null | undefined, lang?: string): string {
  const date = value == null ? null : toDate(value);
  if (!date) return "—";

  // ترتيب سنة/شهر/يوم صريح: يبقى ثابتاً في الاتجاهين ولا يلتبس بـ MM/DD
  const parts = new Intl.DateTimeFormat(localeOf(lang), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}/${get("month")}/${get("day")}`;
}

/** `01:54 م` — الوقت وحده. */
export function formatTime(value: Date | string | null | undefined, lang?: string): string {
  const date = value == null ? null : toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(localeOf(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** `20 أغسطس 2026، 01:54 م` — بترتيب تتكفّل به Intl فلا ينقلب في RTL. */
export function formatDateTime(value: Date | string | null | undefined, lang?: string): string {
  const date = value == null ? null : toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat(localeOf(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * `20 أغسطس • 05:21 ص` — لسطور آخر النشاطات.
 *
 * التاريخ بلا سنة (النشاطات كلها حديثة) والفاصل نقطة وسطى.
 * كل جزء يُبنى بـ Intl على حدة ثم يُوصلان بفاصل محايد الاتجاه، فلا
 * ينقلب الترتيب في واجهة RTL كما كان يحدث مع الدمج اليدوي.
 */
export function formatDayAndTime(
  value: Date | string | null | undefined,
  lang?: string
): string {
  const date = value == null ? null : toDate(value);
  if (!date) return "—";

  const day = new Intl.DateTimeFormat(localeOf(lang), {
    day: "numeric",
    month: "long",
  }).format(date);

  return `${day} • ${formatTime(date, lang)}`;
}

/** `اليوم` / `أمس` وإلا التاريخ المختصر — لرؤوس مجموعات السجلات. */
export function formatRelativeDay(
  value: Date | string | null | undefined,
  lang: string | undefined,
  labels: { today: string; yesterday: string }
): string {
  const date = value == null ? null : toDate(value);
  if (!date) return "—";

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (days === 0) return labels.today;
  if (days === 1) return labels.yesterday;
  return formatDate(date, lang);
}

/**
 * تاريخ اليوم بالتوقيت المحلي بصيغة YYYY-MM-DD — للإرسال إلى الخادم
 * ولقيم حقول <input type="date">.
 *
 * لا تستعمل `new Date().toISOString().slice(0, 10)` لهذا الغرض: فهو يحوّل
 * إلى UTC، فبعد منتصف الليل في منطقة متقدّمة على غرينتش يعيد تاريخ الأمس
 * (الساعة 01:00 يوم 20 بتوقيت +03 هي 22:00 يوم 19 بتوقيت UTC).
 */
export function todayLocal(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
