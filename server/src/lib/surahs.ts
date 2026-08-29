/**
 * سور القرآن الكريم الـ114 مع مواضعها في المصحف المدني (604 صفحات).
 *
 * `pages` هو الوزن المعتمد في حساب النقاط: كم يعادل تسميع السورة من صفحة.
 * لسور جزء عمّ أوزان مضبوطة يدوياً لأن سوراً كثيرة تتشارك الصفحة الواحدة
 * (ثلاث سور في الصفحة 604 مثلاً)، فلو حُسبت كل واحدة صفحةً كاملة لصار
 * تسميع "الناس" مساوياً لصفحة كاملة. أما سور 1–77 فوزنها عدد الصفحات
 * التي تمتد عليها (فرق صفحة البداية عن بداية السورة التالية).
 *
 * الأوزان تقديرية، وهي القيمة الوحيدة التي تحتاج ضبطاً إن أردتم توزيعاً
 * مختلفاً للنقاط.
 */
export interface SurahInfo {
  number: number;
  name: string;
  startPage: number;
  endPage: number;
  /** ما تعادله السورة من صفحات في حساب النقاط. */
  pages: number;
}

export const SURAHS: SurahInfo[] = [
  { number: 1, name: "الفاتحة", startPage: 1, endPage: 1, pages: 1 },
  { number: 2, name: "البقرة", startPage: 2, endPage: 49, pages: 48 },
  { number: 3, name: "آل عمران", startPage: 50, endPage: 76, pages: 27 },
  { number: 4, name: "النساء", startPage: 77, endPage: 105, pages: 29 },
  { number: 5, name: "المائدة", startPage: 106, endPage: 127, pages: 22 },
  { number: 6, name: "الأنعام", startPage: 128, endPage: 150, pages: 23 },
  { number: 7, name: "الأعراف", startPage: 151, endPage: 176, pages: 26 },
  { number: 8, name: "الأنفال", startPage: 177, endPage: 186, pages: 10 },
  { number: 9, name: "التوبة", startPage: 187, endPage: 207, pages: 21 },
  { number: 10, name: "يونس", startPage: 208, endPage: 220, pages: 13 },
  { number: 11, name: "هود", startPage: 221, endPage: 234, pages: 14 },
  { number: 12, name: "يوسف", startPage: 235, endPage: 248, pages: 14 },
  { number: 13, name: "الرعد", startPage: 249, endPage: 254, pages: 6 },
  { number: 14, name: "إبراهيم", startPage: 255, endPage: 261, pages: 7 },
  { number: 15, name: "الحجر", startPage: 262, endPage: 266, pages: 5 },
  { number: 16, name: "النحل", startPage: 267, endPage: 281, pages: 15 },
  { number: 17, name: "الإسراء", startPage: 282, endPage: 292, pages: 11 },
  { number: 18, name: "الكهف", startPage: 293, endPage: 304, pages: 12 },
  { number: 19, name: "مريم", startPage: 305, endPage: 311, pages: 7 },
  { number: 20, name: "طه", startPage: 312, endPage: 321, pages: 10 },
  { number: 21, name: "الأنبياء", startPage: 322, endPage: 331, pages: 10 },
  { number: 22, name: "الحج", startPage: 332, endPage: 341, pages: 10 },
  { number: 23, name: "المؤمنون", startPage: 342, endPage: 349, pages: 8 },
  { number: 24, name: "النور", startPage: 350, endPage: 358, pages: 9 },
  { number: 25, name: "الفرقان", startPage: 359, endPage: 366, pages: 8 },
  { number: 26, name: "الشعراء", startPage: 367, endPage: 376, pages: 10 },
  { number: 27, name: "النمل", startPage: 377, endPage: 384, pages: 8 },
  { number: 28, name: "القصص", startPage: 385, endPage: 395, pages: 11 },
  { number: 29, name: "العنكبوت", startPage: 396, endPage: 403, pages: 8 },
  { number: 30, name: "الروم", startPage: 404, endPage: 410, pages: 7 },
  { number: 31, name: "لقمان", startPage: 411, endPage: 414, pages: 4 },
  { number: 32, name: "السجدة", startPage: 415, endPage: 417, pages: 3 },
  { number: 33, name: "الأحزاب", startPage: 418, endPage: 427, pages: 10 },
  { number: 34, name: "سبأ", startPage: 428, endPage: 433, pages: 6 },
  { number: 35, name: "فاطر", startPage: 434, endPage: 439, pages: 6 },
  { number: 36, name: "يس", startPage: 440, endPage: 445, pages: 6 },
  { number: 37, name: "الصافات", startPage: 446, endPage: 452, pages: 7 },
  { number: 38, name: "ص", startPage: 453, endPage: 457, pages: 5 },
  { number: 39, name: "الزمر", startPage: 458, endPage: 466, pages: 9 },
  { number: 40, name: "غافر", startPage: 467, endPage: 476, pages: 10 },
  { number: 41, name: "فصلت", startPage: 477, endPage: 482, pages: 6 },
  { number: 42, name: "الشورى", startPage: 483, endPage: 488, pages: 6 },
  { number: 43, name: "الزخرف", startPage: 489, endPage: 495, pages: 7 },
  { number: 44, name: "الدخان", startPage: 496, endPage: 498, pages: 3 },
  { number: 45, name: "الجاثية", startPage: 499, endPage: 501, pages: 3 },
  { number: 46, name: "الأحقاف", startPage: 502, endPage: 506, pages: 5 },
  { number: 47, name: "محمد", startPage: 507, endPage: 510, pages: 4 },
  { number: 48, name: "الفتح", startPage: 511, endPage: 514, pages: 4 },
  { number: 49, name: "الحجرات", startPage: 515, endPage: 517, pages: 3 },
  { number: 50, name: "ق", startPage: 518, endPage: 519, pages: 2 },
  { number: 51, name: "الذاريات", startPage: 520, endPage: 522, pages: 3 },
  { number: 52, name: "الطور", startPage: 523, endPage: 525, pages: 3 },
  { number: 53, name: "النجم", startPage: 526, endPage: 527, pages: 2 },
  { number: 54, name: "القمر", startPage: 528, endPage: 530, pages: 3 },
  { number: 55, name: "الرحمن", startPage: 531, endPage: 533, pages: 3 },
  { number: 56, name: "الواقعة", startPage: 534, endPage: 536, pages: 3 },
  { number: 57, name: "الحديد", startPage: 537, endPage: 541, pages: 5 },
  { number: 58, name: "المجادلة", startPage: 542, endPage: 544, pages: 3 },
  { number: 59, name: "الحشر", startPage: 545, endPage: 548, pages: 4 },
  { number: 60, name: "الممتحنة", startPage: 549, endPage: 550, pages: 2 },
  { number: 61, name: "الصف", startPage: 551, endPage: 552, pages: 2 },
  { number: 62, name: "الجمعة", startPage: 553, endPage: 553, pages: 1 },
  { number: 63, name: "المنافقون", startPage: 554, endPage: 555, pages: 2 },
  { number: 64, name: "التغابن", startPage: 556, endPage: 557, pages: 2 },
  { number: 65, name: "الطلاق", startPage: 558, endPage: 559, pages: 2 },
  { number: 66, name: "التحريم", startPage: 560, endPage: 561, pages: 2 },
  { number: 67, name: "الملك", startPage: 562, endPage: 563, pages: 2 },
  { number: 68, name: "القلم", startPage: 564, endPage: 565, pages: 2 },
  { number: 69, name: "الحاقة", startPage: 566, endPage: 567, pages: 2 },
  { number: 70, name: "المعارج", startPage: 568, endPage: 569, pages: 2 },
  { number: 71, name: "نوح", startPage: 570, endPage: 571, pages: 2 },
  { number: 72, name: "الجن", startPage: 572, endPage: 573, pages: 2 },
  { number: 73, name: "المزمل", startPage: 574, endPage: 574, pages: 1 },
  { number: 74, name: "المدثر", startPage: 575, endPage: 576, pages: 2 },
  { number: 75, name: "القيامة", startPage: 577, endPage: 577, pages: 1 },
  { number: 76, name: "الإنسان", startPage: 578, endPage: 579, pages: 2 },
  { number: 77, name: "المرسلات", startPage: 580, endPage: 581, pages: 2 },
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

/** سور جزء عمّ وحدها — يستعملها توليد البيانات التجريبية. */
export const JUZ_AMMA: SurahInfo[] = SURAHS.filter((s) => s.number >= 78);

const BY_NUMBER = new Map(SURAHS.map((s) => [s.number, s]));

/** أصغر رقم سورة وأكبره — للتحقق من المدخلات. */
export const SURAH_FIRST = 1;
export const SURAH_LAST = 114;

/** بيانات السورة برقمها، أو undefined إن كان الرقم خارج 1–114. */
export function surahByNumber(number: number): SurahInfo | undefined {
  return BY_NUMBER.get(number);
}
