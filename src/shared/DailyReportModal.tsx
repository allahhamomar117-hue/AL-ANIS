import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FaTimes, FaWhatsapp, FaDownload } from "react-icons/fa";
import { toPng } from "html-to-image";
import logo from "../assets/logo.png";
import { reportsApi } from "../lib/api";
import { qk } from "../lib/api/queryKeys";
import { useHalaqat } from "../lib/api/hooks";
import { useCurrentHalaqa } from "../lib/api/useCurrentHalaqa";
import type { DailyReport, DailyReportStudent } from "../lib/api/types";
import { surahName } from "../lib/quran/surahs";
import { formatDate, todayLocal } from "../lib/format/date";
import { ErrorState, LoadingState } from "./QueryState";
import { useToast } from "./toast/toastContext";

/**
 * الشعار مُحمَّل سلفاً: الالتقاط لا ينتظر الشبكة، فصورة لم تكتمل
 * تخرج علامةً مائية فارغة.
 *
 * المحاولة مخزَّنة لا نتيجتها: الشعار ملف كبير نسبياً، فإن فشل فكّه مرة
 * (شبكة متقطّعة) أُعيدت المحاولة عند التصدير التالي بدل تثبيت الفشل.
 */
let logoPromise: Promise<boolean> | null = null;

const loadLogo = (): Promise<boolean> => {
  if (!logoPromise) {
    logoPromise = (async () => {
      const image = new Image();
      image.src = logo;
      try {
        await image.decode();
        return true;
      } catch {
        // الشعار زينة لا أكثر — فشل تحميله لا يمنع التصدير
        logoPromise = null;
        return false;
      }
    })();
  }
  return logoPromise;
};

// بدء التحميل فور استيراد الوحدة، قبل أن يفتح المستخدم النافذة.
void loadLogo();

/**
 * عرض ورقة A4 بدقة 96dpi — عرض الصورة المصدَّرة دائماً.
 *
 * العرض وحده ثابت؛ الارتفاع يتبع المحتوى بحدّ أدنى ارتفاع A4، فالحلقة
 * الصغيرة تخرج بورقة كاملة والكبيرة تطول بدل أن تُقصّ أو يصغر خطها.
 */
const A4_WIDTH = 794;
const A4_MIN_HEIGHT = 1123;
/** هامش الورقة من كل جهة. */
const A4_PADDING = 32;
/** عرض محتوى الورقة داخل الهوامش. */
const CONTENT_WIDTH = A4_WIDTH - A4_PADDING * 2;

/**
 * تقرير اليوم لحلقة واحدة، جاهزاً للإرسال إلى مجموعة الأهالي.
 *
 * البيانات كلها من نداء واحد (reports/halaqat/:id/daily) فلا تتفرّق
 * الحالة بين الحضور والتسميع والنقاط.
 */
export default function DailyReportModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { notify } = useToast();

  const current = useCurrentHalaqa();
  const { data: halaqat = [] } = useHalaqat();

  // المدرّس مقيَّد بحلقته؛ المشرف يختار من القائمة
  const [halaqaId, setHalaqaId] = useState<number | "">(current.halaqaId ?? "");
  const date = todayLocal();

  const report = useQuery({
    queryKey: qk.reports.dailyHalaqa(Number(halaqaId), date),
    queryFn: () => reportsApi.dailyHalaqa(Number(halaqaId), date),
    select: (res) => res.data,
    enabled: halaqaId !== "",
  });

  /** ورقة التصدير المخفية — هي وحدها ما يُلتقط. */
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  /** اسم ملف آمن: يُبقي الحروف والأرقام والمسافات فقط، ويذكر الحلقة والتاريخ. */
  const fileName = (halaqa: string) =>
    `${halaqa.replace(/[^\p{L}\p{N} _-]/gu, "-").trim() || "report"}-${date}.png`;

  /**
   * تصدير ورقة التقرير صورةً وتنزيلها.
   *
   * تُلتقط الحاوية المخفية لا نافذة العرض: النافذة تمرّر عمودياً وأفقياً،
   * فكان الالتقاط يخرج مقصوصاً بأشرطة تمرير وبعدد طلاب ناقص. الحاوية
   * المخفية بلا overflow ولا ارتفاع أقصى، فتضم الطلاب كلهم.
   *
   * بلا `transform: scale` إطلاقاً: التحجيم مع محتوى RTL يفسد إحداثيات
   * getBoundingClientRect التي تبني عليها المكتبة، فتخرج الصورة مقصوصة
   * أفقياً. بدلاً منه عرض ثابت وارتفاع حرّ يتبع المحتوى (لقطة طويلة)،
   * فلا حاجة إلى تصغير أصلاً ولا يصغر الخط عن حدّ القراءة.
   *
   * html-to-image يرسم العنصر عبر foreignObject فيحترم CSS كما هو
   * (بما فيه ألوان Tailwind بصيغة oklch)، وpixelRatio 2 يعطي وضوحاً
   * كافياً للقراءة على الجوال.
   */
  const downloadImage = async (halaqa: string) => {
    if (exporting) return null;

    // الورقة تُركَّب الآن: التركيب يسبق الالتقاط، فننتظر دورة رسم كاملة
    // ثم مهلة قصيرة ليكتمل بناء العنصر وتحميل خطوطه.
    setExporting(true);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await new Promise((resolve) => setTimeout(resolve, 120));
    await document.fonts?.ready;
    await loadLogo();

    const node = exportRef.current;
    if (!node) {
      setExporting(false);
      return null;
    }

    try {
      // العرض وحده يُمرَّر؛ الارتفاع يأخذه العنصر من محتواه الفعلي
      const dataUrl = await toPng(node, {
        width: A4_WIDTH,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName(halaqa);
      link.click();

      return dataUrl;
    } catch {
      notify(t("dailyReport.imageFailed"), "error");
      return null;
    } finally {
      setExporting(false);
    }
  };

  /**
   * المشاركة = تنزيل الصورة ثم فتح واتساب ليرفقها المستخدم يدوياً.
   * لا يُمرَّر أي نص في الرابط: الويب لا يسمح بإرفاق ملف برمجياً.
   */
  const shareOnWhatsApp = async (halaqa: string) => {
    const image = await downloadImage(halaqa);
    if (!image) return;

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    window.open(isMobile ? "whatsapp://send" : "https://web.whatsapp.com/", "_blank");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {t("dailyReport.title")}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(date, i18n.language)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-dark-light"
          >
            <FaTimes />
          </button>
        </div>

        {/* اختيار الحلقة — للمشرف فقط، والمدرّس تُفتح على حلقته */}
        {current.showHalaqaPicker && (
          <select
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-gray-600 dark:bg-dark-light dark:text-white"
          >
            <option value="">{t("dailyReport.chooseHalaqa")}</option>
            {halaqat.map((halaqa) => (
              <option key={halaqa.id} value={halaqa.id}>
                {halaqa.name}
              </option>
            ))}
          </select>
        )}

        {halaqaId === "" ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {t("dailyReport.chooseHalaqa")}
          </p>
        ) : report.isPending ? (
          <LoadingState />
        ) : report.isError ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : (
          <>
            {/* الحضور غير مسجّل: التقرير يبقى معروضاً لكن مع تنبيه صريح */}
            {!report.data.recorded && (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                {t("dailyReport.notRecorded")}
              </p>
            )}

            {/*
              المعاينة على الشاشة: تمرّر عمودياً لتُقرأ قائمة الطلاب كاملة
              قبل الحفظ، وأفقياً على الجوال. التمرير هنا وحده — نسخة
              التصدير أدناه بلا أي تمرير كي تخرج الصورة كاملة.
            */}
            <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-sm">
              <ReportSheet data={report.data} />
            </div>

            {/*
              ورقة التصدير: تُركَّب لحظة التصدير فقط، وداخل الشاشة لا خارجها.
              إبعادها آلاف البكسلات جعل المتصفح يتخطّى رسمها توفيراً للأداء،
              فكانت الصورة تخرج بيضاء. هنا تقع أعلى يمين الشاشة خلف طبقة
              النافذة المعتمة (z أدنى منها)، فتُرسم فعلاً ولا تُربك المستخدم.
            */}
            {exporting && (
              <div
                aria-hidden
                // dir="ltr" مقصود: html-to-image يلتقط انطلاقاً من (0,0)
                // يساراً، وحاوية RTL تزيح المحتوى يميناً فتخرج الصورة
                // مقصوصة على آخر عمود. الاتجاه العربي يعود في الداخل.
                dir="ltr"
                className="pointer-events-none fixed"
                style={{
                  top: 0,
                  left: 0,
                  // خلف بطاقة النافذة وأمام خلفيتها المعتمة: يُرسم فعلاً
                  // ولا يحجب ما يقرأه المستخدم أثناء التجهيز
                  zIndex: -1,
                  width: `${A4_WIDTH}px`,
                  // الارتفاع حرّ: ورقة كاملة للحلقة الصغيرة، وأطول للكبيرة
                  minHeight: `${A4_MIN_HEIGHT}px`,
                  height: "auto",
                  padding: `${A4_PADDING}px`,
                  // تدرّج مكتوب صراحةً لا بفئات Tailwind: تدرّجات v4 تُبنى
                  // بمتغيّرات CSS قد لا تنتقل سليمة إلى نسخة foreignObject
                  backgroundColor: "#ffffff",
                  backgroundImage:
                    "linear-gradient(to bottom, rgba(209, 250, 229, 0.45) 0%, rgba(255, 255, 255, 1) 55%)",
                }}
                ref={exportRef}
              >
                {/* العلامة المائية: خلف المحتوى تماماً وبشفافية لا تعيق القراءة */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ zIndex: 0, opacity: 0.06 }}
                >
                  <img
                    src={logo}
                    alt=""
                    style={{ height: "560px", width: "auto", maxWidth: "70%", objectFit: "contain" }}
                  />
                </div>

                <div
                  dir={i18n.language === "ar" ? "rtl" : "ltr"}
                  style={{ width: `${CONTENT_WIDTH}px`, position: "relative", zIndex: 10 }}
                >
                  <ReportSheet data={report.data} print />
                </div>
              </div>
            )}

            <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 dark:bg-dark-light dark:text-gray-300">
              {t("dailyReport.shareNotice")}
            </p>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => void downloadImage(report.data.halaqa.name)}
                disabled={exporting}
                className="flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-light"
              >
                {exporting ? <Spinner /> : <FaDownload />}
                {exporting ? t("dailyReport.preparing") : t("dailyReport.downloadImage")}
              </button>
              <button
                type="button"
                onClick={() => void shareOnWhatsApp(report.data.halaqa.name)}
                disabled={exporting}
                className="flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-2.5 font-bold text-white shadow transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? <Spinner /> : <FaWhatsapp className="text-lg" />}
                {exporting ? t("dailyReport.preparing") : t("dailyReport.share")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

/** دوّارة صغيرة تُظهر أن التقاط الصورة جارٍ. */
function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/* ================= ورقة المتابعة ================= */

/**
 * جدول التقرير — بخلفية بيضاء ثابتة في الوضعين، فهو يُقرأ كورقة رسمية.
 *
 * `print`: نسخة التصدير — بلا تمرير أفقي ولا عرض أدنى يفرض القص،
 * وبعدّاد الطلاب في الترويسة كي يتأكد قارئ الصورة أنّها كاملة.
 */
function ReportSheet({ data, print }: { data: DailyReport; print?: boolean }) {
  const { t, i18n } = useTranslation();

  const describeRecitation = (student: DailyReportStudent) =>
    student.recitations
      .map((r) => {
        const surah = surahName(r.surahNumber);
        if (surah) return t("dailyReport.surah", { surah });
        if (r.type === "more" && r.toPage)
          return t("dailyReport.pageRange", { from: r.pageNumber, to: r.toPage });
        return t("dailyReport.page", { page: r.pageNumber });
      })
      .join(" + ");

  /**
   * أسباب حركات النقاط اليدوية لليوم، مدموجة بفاصل واحد.
   *
   * الحركة بلا سبب تُتجاهَل لا تُعرض فارغة، والسبب المكرَّر يُذكر مرة
   * واحدة (مكافأتان بالسبب نفسه لا تعنيان سطرين). ومع أكثر من حركة
   * تُذكر قيمة كل واحدة قبل سببها كي يُعرف مصدر المجموع.
   */
  const describeReasons = (student: DailyReportStudent) => {
    const entries = (student.participationEntries ?? []).filter((e) => e.reason?.trim());
    if (entries.length === 0) return "";

    const parts = entries.map((entry) =>
      entries.length > 1
        ? `${entry.delta > 0 ? "+" : "−"}${Math.abs(entry.delta)} ${entry.reason!.trim()}`
        : entry.reason!.trim()
    );
    return [...new Set(parts)].join(" · ");
  };

  /** ألوان الحالة داخل الورقة — بلا dark: لأن خلفية الورقة بيضاء في الوضعين. */
  const statusChip = (status: DailyReportStudent["status"]) => {
    if (!status) return "bg-gray-100 text-gray-500";
    if (status === "present") return "bg-emerald-100 text-emerald-800";
    if (status === "late") return "bg-amber-100 text-amber-800";
    if (status === "excused") return "bg-sky-100 text-sky-800";
    return "bg-red-100 text-red-800";
  };

  // نسخة التصدير أضيق حشواً وأصغر خطاً: تقصّر الورقة طبيعياً بلا تحجيم
  const cell = print ? "px-2 py-1.5 text-xs" : "px-3 py-2";

  return (
    <div className={print ? "w-full" : ""} dir={i18n.language === "ar" ? "rtl" : "ltr"}>
      <div
        className={`border-b border-gray-300 text-center ${print ? "px-3 py-2" : "px-4 py-3"}`}
      >
        <p className="text-base font-bold text-gray-800">
          {t("dailyReport.sheetTitle", { halaqa: data.halaqa.name })}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {formatDate(data.date, i18n.language)}
          {data.halaqa.teacher ? ` · ${data.halaqa.teacher}` : ""}
          {print ? ` · ${t("dailyReport.studentCount", { count: data.students.length })}` : ""}
        </p>
      </div>

      {/* على الشاشة يمرّر الجدول أفقياً؛ في التصدير لا تمرير ولا عرض أدنى */}
      <div className={print ? "" : "overflow-x-auto"}>
        <table
          className={`w-full border-collapse text-sm ${print ? "table-fixed" : "min-w-[520px]"}`}
        >
          <thead>
            <tr className={`text-gray-700 ${print ? "bg-gray-100/80" : "bg-gray-100"}`}>
              <th className={`border-b border-gray-300 text-start font-bold ${cell}`}>
                {t("dailyReport.columns.student")}
              </th>
              <th className={`border-b border-s border-gray-300 text-center font-bold ${cell}`}>
                {t("dailyReport.columns.attendance")}
              </th>
              <th className={`border-b border-s border-gray-300 text-center font-bold ${cell}`}>
                {t("dailyReport.columns.participation")}
              </th>
              <th className={`border-b border-s border-gray-300 text-start font-bold ${cell}`}>
                {t("dailyReport.columns.recitation")}
              </th>
            </tr>
          </thead>

          <tbody>
            {data.students.map((student, index) => {
              const recitation = describeRecitation(student);
              const ratings = [...new Set(student.recitations.map((r) => r.rating))];
              const reasons = describeReasons(student);

              return (
                <tr
                  key={student.id}
                  // في التصدير خلفيات نصف شفافة كي تظهر العلامة المائية تحتها
                  className={
                    print
                      ? index % 2
                        ? "bg-gray-50/70"
                        : "bg-white/60"
                      : index % 2
                        ? "bg-gray-50"
                        : "bg-white"
                  }
                >
                  <td className={`border-b border-gray-200 font-semibold text-gray-800 ${cell}`}>
                    {student.name}
                  </td>

                  <td className={`border-b border-s border-gray-200 text-center ${cell}`}>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${statusChip(student.status)}`}
                    >
                      {student.status
                        ? t(`attendanceStatus.${student.status}`)
                        : t("dailyReport.noStatus")}
                    </span>
                  </td>

                  {/*
                    العمود يجمع حركات النقاط اليدوية لليوم، وهي
                    مكافآت وحسومات معاً. الشرط `> 0` وحده كان يُخفي
                    الحسم فيصل التقرير إلى الأهالي ناقصاً، فنعرض
                    الإشارتين ونميّزهما باللون.
                  */}
                  <td className={`border-b border-s border-gray-200 text-center font-bold ${cell}`}>
                    {student.participation > 0 && (
                      <span className="text-emerald-700">+{student.participation}</span>
                    )}
                    {student.participation < 0 && (
                      <span className="text-red-700">−{Math.abs(student.participation)}</span>
                    )}
                    {student.participation === 0 && (
                      <span className="font-normal text-gray-400">—</span>
                    )}

                    {/* الأسباب أسفل الرقم: أصغر وأبهت كي لا يزدحم العمود */}
                    {reasons && (
                      <span className="mt-0.5 block text-[10px] font-normal leading-snug text-gray-500">
                        {reasons}
                      </span>
                    )}
                  </td>

                  <td className={`border-b border-s border-gray-200 text-gray-700 ${cell}`}>
                    {recitation ? (
                      <span>
                        {recitation}
                        {ratings.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {" · "}
                            {ratings
                              .map((rating) =>
                                t(
                                  `recitationRegistration.ratings.${rating === "needs" ? "average" : rating}`
                                )
                              )
                              .join(" / ")}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t("dailyReport.noRecitation")}</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {data.students.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-sm text-gray-400">
                  {t("allStudents.noStudents")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
