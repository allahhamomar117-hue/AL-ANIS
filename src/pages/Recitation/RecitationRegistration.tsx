import { useState } from "react";
import { BookOpen, ThumbsUp, CheckCircle, Save, AlertCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recitationsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { useStudent } from "../../lib/api/hooks";
import Avatar from "../../shared/Avatar";
import { ErrorState, LoadingState } from "../../shared/QueryState";
import { SURAHS } from "../../lib/quran/surahs";
import { formatDate, todayLocal } from "../../lib/format/date";
import { useToast } from "../../shared/toast/toastContext";

/* ================= TYPES ================= */
type RecitationType = "full" | "more" | "surah";
type Rating = "excellent" | "good" | "needs";
/** طريقة تحديد المُسمَّع: بالصفحة أو بالسورة — وكلاهما يغطي المصحف كله. */
type InputMode = "page" | "surah";

/* ================= MAIN ================= */
/**
 * إدخال التسميع — مضغوط ليكتمل في شاشة جوال واحدة بلا تمرير:
 * بطاقة واحدة بأقسام صغيرة، والخيارات أشرطة أفقية بنقرة واحدة.
 */
export default function RecitationRegistration() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { studentId: studentIdParam, groupId, lang = "ar" } = useParams();

  const studentId = Number(studentIdParam);
  const halaqaId = Number(groupId);

  /** رجوع صريح إلى قائمة طلاب الحلقة — أوثق من navigate(-1). */
  const backToList = () =>
    groupId ? navigate(`/${lang}/recitation-groups/${groupId}`) : navigate(-1);

  const [inputMode, setInputMode] = useState<InputMode>("page");
  const [surahNumber, setSurahNumber] = useState<number | "">("");
  const [recitationType, setRecitationType] = useState<RecitationType>("full");
  const [rating, setRating] = useState<Rating>("good");
  const [notes, setNotes] = useState("");

  const [pageNumber, setPageNumber] = useState<number | "">("");
  const [toPage, setToPage] = useState<number | "">("");

  const student = useStudent(studentId);
  const isSurahMode = inputMode === "surah";

  const create = useMutation({
    mutationFn: () =>
      recitationsApi.create({
        studentId,
        halaqaId: Number.isFinite(halaqaId) ? halaqaId : undefined,
        // بالسورة: الخادم يشتقّ الصفحات ووزن النقاط، فنرسل رقم السورة فقط
        ...(isSurahMode
          ? { type: "surah" as const, surahNumber: Number(surahNumber) }
          : {
              type: recitationType,
              pageNumber: Number(pageNumber),
              toPage: recitationType === "more" ? Number(toPage) : null,
              verse: null,
              pageCompleted: true,
            }),
        rating,
        notes: notes.trim() || null,
        // نرسل تاريخ جهاز المستخدم صراحةً: القيمة الافتراضية في الخادم
        // تتبع منطقة الخادم وقد تختلف عن منطقة المدرّس
        recitedAt: todayLocal(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.recitations.all });
      // التسميع يمنح نقاطاً، فتتأثر أرصدة الطلاب والحلقات والتقارير
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.halaqat.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
      notify(t("recitationRegistration.saved"));
      backToList();
    },
  });

  // نفس شروط الخادم: بالسورة يكفي اختيارها، و«أكثر من صفحة» يتطلب نهاية صحيحة
  const valid = isSurahMode
    ? typeof surahNumber === "number"
    : typeof pageNumber === "number" &&
      pageNumber > 0 &&
      (recitationType !== "more" || (typeof toPage === "number" && toPage >= pageNumber));

  if (student.isPending) {
    return (
      <div className="min-h-screen bg-white pt-20 dark:bg-dark-light md:pt-24">
        <LoadingState />
      </div>
    );
  }

  if (student.isError) {
    return (
      <div className="min-h-screen bg-white pt-20 dark:bg-dark-light md:pt-24">
        <ErrorState error={student.error} onRetry={() => void student.refetch()} />
      </div>
    );
  }

  const data = student.data.data;
  const today = formatDate(new Date(), i18n.language);

  const numeric = (value: string) => (value === "" ? "" : Number(value));
  const inputClass =
    "w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-800 " +
    "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 " +
    "dark:border-gray-600 dark:bg-dark-light dark:text-white";
  const labelClass = "mb-1 block text-xs font-bold text-gray-500 dark:text-gray-400";

  return (
    <div className="min-h-screen bg-gray-50 px-3 pb-6 pt-[4.5rem] dark:bg-dark-light md:px-4 md:pt-24">
      <div className="mx-auto max-w-2xl space-y-2">
        {/* ---------- رأس الطالب: صورة مصغّرة + الاسم + الحلقة والتاريخ ---------- */}
        <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-dark">
          <Avatar name={data.name} url={data.avatarUrl} className="size-11" />

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-bold leading-tight text-gray-800 dark:text-white">
              {data.name}
            </h2>
            <p className="truncate text-[11px] leading-tight text-gray-500 dark:text-gray-400">
              {data.halaqa || t("common.none")} · {today}
            </p>
          </div>
        </div>

        {/* ---------- بطاقة الإدخال ---------- */}
        <div className="space-y-3 rounded-xl bg-white p-3 shadow-sm dark:bg-dark">
          {/* طريقة التحديد: بالصفحة أو بالسورة */}
          <section>
            <p className={`${labelClass} flex items-center gap-1.5`}>
              <BookOpen size={13} />
              {t("recitationRegistration.inputMode.label")}
            </p>
            <Segmented
              options={[
                { value: "page", label: t("recitationRegistration.inputMode.byPage") },
                { value: "surah", label: t("recitationRegistration.inputMode.bySurah") },
              ]}
              value={inputMode}
              onChange={setInputMode}
            />
          </section>

          {/* نوع التسميع — بالصفحة فقط؛ مع السورة يُحسب المقدار من السورة نفسها */}
          {!isSurahMode && (
            <section>
              <p className={labelClass}>{t("recitationRegistration.recitationType")}</p>
              <Segmented
                options={[
                  { value: "full", label: t("recitationRegistration.types.full") },
                  { value: "more", label: t("recitationRegistration.types.more") },
                ]}
                value={recitationType}
                onChange={setRecitationType}
              />
            </section>
          )}

          {/* اختيار السورة — القائمة المنسدلة وحدها، بكل سور المصحف */}
          {isSurahMode && (
            <section>
              <label className={labelClass}>{t("recitationRegistration.surah")}</label>
              <select
                value={surahNumber}
                onChange={(e) => setSurahNumber(e.target.value === "" ? "" : Number(e.target.value))}
                className={inputClass}
              >
                <option value="">{t("recitationRegistration.chooseSurah")}</option>
                {SURAHS.map((surah) => (
                  <option key={surah.number} value={surah.number}>
                    {surah.number} · {surah.name}
                  </option>
                ))}
              </select>
            </section>
          )}

          {/* الصفحات — حقلان جنباً إلى جنب حسب نوع التسميع */}
          <section className={`grid grid-cols-2 gap-2 ${isSurahMode ? "hidden" : ""}`}>
            <div className={recitationType === "full" ? "col-span-2" : "col-span-1"}>
              <label className={labelClass}>
                {recitationType === "more"
                  ? t("recitationRegistration.fromPage")
                  : t("recitationRegistration.pageNumber")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={604}
                value={pageNumber}
                onChange={(e) => setPageNumber(numeric(e.target.value))}
                className={inputClass}
              />
            </div>

            {recitationType === "more" && (
              <div>
                <label className={labelClass}>{t("recitationRegistration.toPage")}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={604}
                  value={toPage}
                  onChange={(e) => setToPage(numeric(e.target.value))}
                  className={inputClass}
                />
              </div>
            )}

          </section>

          {/* التقييم — شريط أفقي بثلاثة خيارات */}
          <section>
            <p className={labelClass}>{t("recitationRegistration.studentRating")}</p>
            <Segmented
              options={[
                {
                  value: "excellent",
                  label: t("recitationRegistration.ratings.excellent"),
                  icon: <CheckCircle size={13} />,
                },
                {
                  value: "good",
                  label: t("recitationRegistration.ratings.good"),
                  icon: <ThumbsUp size={13} />,
                },
                {
                  value: "needs",
                  label: t("recitationRegistration.ratings.average"),
                  icon: <AlertCircle size={13} />,
                },
              ]}
              value={rating}
              onChange={setRating}
            />
          </section>

          {/* الملاحظات — سطران يكفيان لملاحظة سريعة */}
          <section>
            <label className={labelClass}>{t("recitationRegistration.teacherNotes")}</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} resize-none py-2 leading-snug`}
              placeholder={t("recitationRegistration.notesPlaceholder")}
            />
          </section>
        </div>

        {create.isError && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {create.error instanceof Error ? create.error.message : t("state.error")}
          </p>
        )}

        {/* ---------- الأزرار ---------- */}
        <div className="flex gap-2">
          <button
            onClick={() => create.mutate()}
            disabled={!valid || create.isPending}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500
              font-bold text-white shadow-md transition hover:bg-emerald-600 active:scale-[0.98]
              disabled:opacity-50 disabled:active:scale-100"
          >
            <Save size={17} />
            {create.isPending
              ? t("recitationRegistration.saving")
              : t("recitationRegistration.save")}
          </button>

          <button
            onClick={backToList}
            disabled={create.isPending}
            className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-5 font-semibold text-gray-700
              transition hover:bg-gray-100 active:scale-95 disabled:opacity-50
              dark:border-gray-600 dark:bg-dark dark:text-white dark:hover:bg-dark-light"
          >
            {t("recitationRegistration.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= SEGMENTED CONTROL ================= */
/** خيارات متراصة في سطر واحد — بديل القوائم المتباعدة. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="grid gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-light"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex min-h-[40px] items-center justify-center gap-1 rounded-lg px-1 text-xs font-bold
              leading-tight transition active:scale-95 ${
                active
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-dark"
              }`}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
