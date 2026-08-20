/**
 * أسماء سور جزء عمّ للعرض في واجهة التسميع.
 *
 * الأرقام فقط هي ما يُرسَل إلى الخادم؛ مواضع الصفحات وأوزان النقاط
 * محفوظة في الخادم (`server/src/lib/juzAmma.ts`) وهو المرجع الوحيد لها،
 * فلا يوجد جدول صفحات مكرَّر هنا يمكن أن يتعارض معه.
 */
export interface JuzAmmaSurah {
  number: number;
  /** الاسم العربي — يُعرض كما هو في الواجهتين العربية والإنجليزية. */
  name: string;
}

export const JUZ_AMMA: JuzAmmaSurah[] = [
  { number: 78, name: "النبأ" },
  { number: 79, name: "النازعات" },
  { number: 80, name: "عبس" },
  { number: 81, name: "التكوير" },
  { number: 82, name: "الانفطار" },
  { number: 83, name: "المطففين" },
  { number: 84, name: "الانشقاق" },
  { number: 85, name: "البروج" },
  { number: 86, name: "الطارق" },
  { number: 87, name: "الأعلى" },
  { number: 88, name: "الغاشية" },
  { number: 89, name: "الفجر" },
  { number: 90, name: "البلد" },
  { number: 91, name: "الشمس" },
  { number: 92, name: "الليل" },
  { number: 93, name: "الضحى" },
  { number: 94, name: "الشرح" },
  { number: 95, name: "التين" },
  { number: 96, name: "العلق" },
  { number: 97, name: "القدر" },
  { number: 98, name: "البينة" },
  { number: 99, name: "الزلزلة" },
  { number: 100, name: "العاديات" },
  { number: 101, name: "القارعة" },
  { number: 102, name: "التكاثر" },
  { number: 103, name: "العصر" },
  { number: 104, name: "الهمزة" },
  { number: 105, name: "الفيل" },
  { number: 106, name: "قريش" },
  { number: 107, name: "الماعون" },
  { number: 108, name: "الكوثر" },
  { number: 109, name: "الكافرون" },
  { number: 110, name: "النصر" },
  { number: 111, name: "المسد" },
  { number: 112, name: "الإخلاص" },
  { number: 113, name: "الفلق" },
  { number: 114, name: "الناس" },
];

/** اسم السورة برقمها، أو null إن كانت خارج جزء عمّ. */
export function surahName(number: number | null | undefined): string | null {
  if (number == null) return null;
  return JUZ_AMMA.find((s) => s.number === number)?.name ?? null;
}
