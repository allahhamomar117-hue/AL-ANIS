/**
 * سور جزء عمّ (من النبأ إلى الناس) مع مواضعها في المصحف المدني (604 صفحات).
 *
 * `pages` هو الوزن المعتمد في حساب النقاط: كم يعادل تسميع السورة من صفحة.
 * سور كثيرة في هذا الجزء تتشارك الصفحة الواحدة (ثلاث سور في الصفحة 604 مثلاً)،
 * فلو حُسبت كل واحدة صفحةً كاملة لصار تسميع "الناس" مساوياً لصفحة كاملة.
 * لذلك الوزن كسريّ، ومجموع أوزان سور الصفحة الواحدة ≈ 1.
 *
 * الأوزان تقديرية بحسب المساحة التي تشغلها السورة، وهي القيمة الوحيدة التي
 * تحتاج ضبطاً إن أردتم توزيعاً مختلفاً للنقاط.
 */
export interface SurahInfo {
  number: number;
  name: string;
  startPage: number;
  endPage: number;
  /** ما تعادله السورة من صفحات في حساب النقاط. */
  pages: number;
}

export const JUZ_AMMA: SurahInfo[] = [
  { number: 78, name: "النبأ", startPage: 582, endPage: 583, pages: 1.5 },
  { number: 79, name: "النازعات", startPage: 583, endPage: 584, pages: 1.5 },
  { number: 80, name: "عبس", startPage: 585, endPage: 585, pages: 1 },
  { number: 81, name: "التكوير", startPage: 586, endPage: 586, pages: 1 },
  { number: 82, name: "الانفطار", startPage: 587, endPage: 587, pages: 0.5 },
  { number: 83, name: "المطففين", startPage: 587, endPage: 589, pages: 2 },
  { number: 84, name: "الانشقاق", startPage: 589, endPage: 589, pages: 0.7 },
  { number: 85, name: "البروج", startPage: 590, endPage: 590, pages: 1 },
  { number: 86, name: "الطارق", startPage: 591, endPage: 591, pages: 0.5 },
  { number: 87, name: "الأعلى", startPage: 591, endPage: 592, pages: 0.7 },
  { number: 88, name: "الغاشية", startPage: 592, endPage: 593, pages: 0.8 },
  { number: 89, name: "الفجر", startPage: 593, endPage: 594, pages: 1.3 },
  { number: 90, name: "البلد", startPage: 594, endPage: 594, pages: 0.6 },
  { number: 91, name: "الشمس", startPage: 595, endPage: 595, pages: 0.5 },
  { number: 92, name: "الليل", startPage: 595, endPage: 596, pages: 0.6 },
  { number: 93, name: "الضحى", startPage: 596, endPage: 596, pages: 0.4 },
  { number: 94, name: "الشرح", startPage: 596, endPage: 596, pages: 0.25 },
  { number: 95, name: "التين", startPage: 597, endPage: 597, pages: 0.3 },
  { number: 96, name: "العلق", startPage: 597, endPage: 598, pages: 0.8 },
  { number: 97, name: "القدر", startPage: 598, endPage: 598, pages: 0.25 },
  { number: 98, name: "البينة", startPage: 598, endPage: 599, pages: 0.7 },
  { number: 99, name: "الزلزلة", startPage: 599, endPage: 599, pages: 0.3 },
  { number: 100, name: "العاديات", startPage: 599, endPage: 600, pages: 0.4 },
  { number: 101, name: "القارعة", startPage: 600, endPage: 600, pages: 0.3 },
  { number: 102, name: "التكاثر", startPage: 600, endPage: 600, pages: 0.25 },
  { number: 103, name: "العصر", startPage: 601, endPage: 601, pages: 0.15 },
  { number: 104, name: "الهمزة", startPage: 601, endPage: 601, pages: 0.3 },
  { number: 105, name: "الفيل", startPage: 601, endPage: 601, pages: 0.2 },
  { number: 106, name: "قريش", startPage: 602, endPage: 602, pages: 0.2 },
  { number: 107, name: "الماعون", startPage: 602, endPage: 602, pages: 0.25 },
  { number: 108, name: "الكوثر", startPage: 602, endPage: 602, pages: 0.12 },
  { number: 109, name: "الكافرون", startPage: 603, endPage: 603, pages: 0.2 },
  { number: 110, name: "النصر", startPage: 603, endPage: 603, pages: 0.15 },
  { number: 111, name: "المسد", startPage: 603, endPage: 603, pages: 0.18 },
  { number: 112, name: "الإخلاص", startPage: 604, endPage: 604, pages: 0.15 },
  { number: 113, name: "الفلق", startPage: 604, endPage: 604, pages: 0.15 },
  { number: 114, name: "الناس", startPage: 604, endPage: 604, pages: 0.18 },
];

const BY_NUMBER = new Map(JUZ_AMMA.map((s) => [s.number, s]));

/** أصغر رقم سورة في جزء عمّ وأكبره — للتحقق من المدخلات. */
export const JUZ_AMMA_FIRST = 78;
export const JUZ_AMMA_LAST = 114;

/** بيانات السورة، أو undefined إن كانت خارج جزء عمّ. */
export function surahByNumber(number: number): SurahInfo | undefined {
  return BY_NUMBER.get(number);
}
