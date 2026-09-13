import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaClipboardList,
  FaHistory,
  FaSave,
} from "react-icons/fa";
import { assignmentsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import type { AssignmentSheet } from "../../lib/api/types";
import { todayLocal } from "../../lib/format/date";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import { ErrorState, LoadingState } from "../../shared/QueryState";
import { useToast } from "../../shared/toast/toastContext";
import Avatar from "../../shared/Avatar";

/**
 * تسجيل مقرَّر اليوم وإنجازات طلاب الحلقة — لقسم المكثفة وحده.
 *
 * الصفحة نسخة من صفحة الحضور في بنيتها وسلوكها معاً: عنوانٌ وتاريخ في
 * الأعلى، بطاقة لكل طالب بمفتاح تبديل، وزرٌّ واحد أسفل الصفحة يحفظ
 * الورقة كاملة. التبديل يغيّر حالةً محلية فقط — لا شبكة قبل الحفظ.
 *
 * ── لماذا الحالة المحلية لا الإرسال الفوري؟ ─────────────────────────
 * الأستاذ معتاد نمط الحضور: يؤشّر ثم يحفظ. والإرسال عند كل ضغطة يكسر
 * هذه العادة ويجعل التراجع عن خطأ إجراءً شبكياً بدل تصحيحٍ قبل الحفظ.
 * والخادم يقابل ذلك بمزامنةٍ بالفرق داخل معاملة واحدة: يمنح نقاط من
 * أُضيف ويسحب نقاط من أُزيل، ومن لم يتغيّر لا يُمسّ.
 */
export default function AssignmentsPage() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();

  const halaqaId = Number(params.id);

  /*
   * التاريخ يُقرأ من الرابط إن وُجد: صفحة السجلّات تفتح يوماً مضى
   * للتعديل عبر ?date=، فبدونه كانت تفتح على اليوم الحالي وتُظهر ورقة
   * فارغة بدل السجلّ المطلوب.
   */
  const [search] = useSearchParams();
  const [date, setDate] = useState(search.get("date") || todayLocal());

  const { isTeacher } = useCurrentHalaqa();
  const lang = params?.lang || "ar";
  // المدرّس تُفتح صفحةُ الاختيار على حلقته فترتدّ إلى هنا — فيعود للرئيسية
  const backTo = isTeacher ? `/${lang}` : `/${lang}/assignments-groups`;

  const sheet = useQuery({
    queryKey: qk.assignments.sheet(halaqaId, date),
    queryFn: () => assignmentsApi.sheet(halaqaId, date),
    select: (res) => res.data,
    enabled: Number.isFinite(halaqaId),
  });

  return (
    <div className="rtl min-h-screen bg-white px-4 pb-6 pt-18 transition-colors duration-300 dark:bg-dark-light sm:px-6 md:pt-24">
      {/*
        اسم الحلقة سطرٌ تحت العنوان لا فقرة مستقلّة بكلمة "الحلقة:" —
        السياق ظاهر من الصفحة نفسها، والكلمة كانت تأكل سطراً كاملاً على
        الجوال لتقول ما يقوله الاسم وحده.
      */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white sm:text-2xl">
            {t("assignmentsPage.title")}
          </h1>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">
            {sheet.data?.halaqa.name ?? "…"}
          </p>
        </div>

        <button
          onClick={() => navigate(backTo)}
          aria-label={isTeacher ? t("common.backHome") : t("assignmentsPage.back")}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-gray-200 px-3 py-2
            text-sm font-semibold text-gray-700 shadow transition hover:bg-gray-300 dark:bg-dark
            dark:text-white dark:hover:bg-dark-dark"
        >
          <FaArrowLeft />
          {/* النصّ يظهر على الشاشات الواسعة وحدها: السهم وحده مفهوم،
              والكلمتان تزاحمان العنوان على جوال ضيّق */}
          <span className="hidden sm:inline">
            {isTeacher ? t("common.backHome") : t("assignmentsPage.back")}
          </span>
        </button>
      </div>

      {/*
        شريط التاريخ — نصفه منتقي تاريخ ونصفه مدخلٌ إلى السجلّ.
        ─────────────────────────────────────────────────────────────
        المساحة الفارغة من الشريط ليست حشواً بل زرٌّ يمتدّ عليها
        (flex-1)، فالنقر في أي موضع عدا حقل التاريخ يفتح سجلّ
        المقرَّرات. وهذا هو المنفذ الوحيد للمدرّس إليه: صفحة اختيار
        الحلقة — حيث زرّ السجلّ — تُحوّله تلقائياً إلى حلقته فلا يراها.

        ⚠ ولماذا زرٌّ داخل الشريط لا onClick على الشريط كلّه؟ لأن الشريط
          يحوي <input type="date">، فنقرةُ فتح المنتقي كانت ستصعد إلى
          الحاوية فتنقل الأستاذ إلى السجلّ بدل أن تفتح التقويم. ولأن
          <div> بـ onClick لا يبلغه التنقّل بلوحة المفاتيح ولا يعلنه
          قارئ الشاشة زرّاً.
      */}
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow transition-colors duration-300 dark:bg-dark">
        <FaCalendarAlt className="shrink-0 text-primary" />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border bg-white px-2 py-1 text-sm text-gray-800 focus:outline-none
            focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-dark-light dark:text-white"
        />

        <button
          type="button"
          onClick={() => navigate(`/${lang}/assignments-groups/assignments-record`)}
          aria-label={t("assignmentGroups.recordButton")}
          className="-my-2 -me-3 flex flex-1 cursor-pointer items-center justify-end gap-1.5 self-stretch
            rounded-e-xl py-2 pe-3 ps-2 text-gray-400 transition hover:bg-gray-50 hover:text-primary
            dark:hover:bg-dark-light"
        >
          {/* تنبيه "مسجَّل مسبقاً" داخل الزرّ: يبقى ظاهراً ولا يقتطع من
              مساحة النقر، والشريط يبقى سطراً واحداً على الجوال */}
          {sheet.data?.recorded && (
            <span className="truncate text-xs font-semibold text-amber-600 dark:text-amber-400">
              {t("assignmentsPage.recordedNotice")}
            </span>
          )}
          <FaHistory className="shrink-0 text-sm" />
          {/* الشيفرون يتبع اتجاه الصفحة: يسار في العربية ويمين في الإنجليزية */}
          {i18n.language === "en" ? (
            <FaChevronRight className="shrink-0 text-[10px]" />
          ) : (
            <FaChevronLeft className="shrink-0 text-[10px]" />
          )}
        </button>
      </div>

      {sheet.isPending ? (
        <LoadingState />
      ) : sheet.isError ? (
        <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
      ) : (
        /* المفتاح يعيد تهيئة النموذج عند تغيّر الحلقة أو التاريخ، فلا حاجة
           لمزامنته بـ useEffect — نفس نهج صفحة الحضور. */
        <AssignmentSheetForm
          key={`${halaqaId}-${date}`}
          sheet={sheet.data}
          halaqaId={halaqaId}
          date={date}
        />
      )}
    </div>
  );
}

/** نموذج تسجيل المقرَّر — حالته المحلية تبدأ من الورقة القادمة من الخادم. */
function AssignmentSheetForm({
  sheet,
  halaqaId,
  date,
}: {
  sheet: AssignmentSheet;
  halaqaId: number;
  date: string;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [title, setTitle] = useState(sheet.title);

  /** التعديلات المحلية قبل الحفظ: معرّف الطالب → أنجز؟ */
  const [done, setDone] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(sheet.students.map((s) => [s.id, s.completedId !== null]))
  );
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      assignmentsApi.save({
        halaqaId,
        title: title.trim(),
        date,
        // القائمة هي الحالة النهائية: من غاب عنها يُسحب إنجازه في الخادم
        students: Object.entries(done)
          .filter(([, isDone]) => isDone)
          .map(([id]) => Number(id)),
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: qk.assignments.all });
      /*
       * الإنجاز يمنح نقاطاً، فتتأثر أرصدة الطلاب وبطاقات الحلقات
       * والتقارير — نفس ما يُبطله حفظ الحضور للسبب نفسه.
       */
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.halaqat.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
      notify(t("assignmentsPage.saved"));
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : t("state.error"), "error"),
  });

  const toggle = (id: number) => {
    setDone((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  };

  const setAll = (value: boolean) => {
    setDone(Object.fromEntries(sheet.students.map((s) => [s.id, value])));
    setSaved(false);
  };

  const doneCount = Object.values(done).filter(Boolean).length;
  const switchTextClass = i18n.language === "en" ? "text-[10px]" : "text-[12px]";

  /** الحفظ يحتاج عنواناً: المقرَّر بلا عنوان لا يقول للأهالي شيئاً. */
  const canSave = title.trim().length > 0 && sheet.students.length > 0;

  return (
    <>
      {/*
        عنوان المقرَّر — بلا عنوان فرعي فوق الحقل ولا شرحٍ تحته.
        نصّ الحقل الإرشادي (placeholder) يقول المطلوب بمثالٍ حيّ، ونقاط
        الإنجاز باتت ملحوظةً بجانب العدّاد أدناه حيث تُقرأ وقت الحاجة
        إليها لا فوقها دائماً.
      */}
      <div className="mb-3 rounded-xl bg-white p-3 shadow transition-colors duration-300 dark:bg-dark">
        <div className="flex items-center gap-2">
          <FaClipboardList className="shrink-0 text-primary" />
          <input
            id="assignment-title"
            type="text"
            value={title}
            maxLength={200}
            aria-label={t("assignmentsPage.titleLabel")}
            placeholder={t("assignmentsPage.titlePlaceholder")}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800
              focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600
              dark:bg-dark-light dark:text-white"
          />
        </div>
      </div>

      {/*
        سطر العدّاد: العدد المنجَز من الإجمالي، ونقاط الإنجاز بجانبه
        ملحوظةً صغيرة — هنا موضعها، إذ يقرؤها الأستاذ وهو يؤشّر لا وهو
        يكتب العنوان.
      */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-800 dark:text-white">
          <span className="text-primary">
            {doneCount}/{sheet.students.length}
          </span>{" "}
          <span className="font-medium text-gray-400">
            · +{sheet.pointsPerCompletion} {t("common.points")}
          </span>
        </h2>

        <div className="flex gap-2">
          <button
            onClick={() => setAll(true)}
            className="rounded-lg bg-primary-light px-3 py-1 text-xs font-semibold text-primary-dark transition hover:bg-primary hover:text-white"
          >
            {t("assignmentsPage.markAll")}
          </button>
          <button
            onClick={() => setAll(false)}
            className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-300 dark:bg-dark dark:text-gray-200"
          >
            {t("assignmentsPage.clearAll")}
          </button>
        </div>
      </div>

      {/*
        البطاقات متراصّة بفاصل واحد بدل هامش أسفل كل بطاقة: الفاصل
        الموحَّد لا يترك هامشاً معلّقاً بعد آخر بطاقة قبل زرّ الحفظ.
      */}
      <div className="space-y-2">
        {sheet.students.map((student, index) => (
          <div
            key={student.id}
            className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 shadow transition-colors duration-300 dark:bg-dark"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative shrink-0">
                <Avatar name={student.name} url={student.avatarUrl} className="size-9" />
                <span
                  className="absolute -top-1 -start-1 flex size-4.5 items-center justify-center rounded-full
                    bg-primary-light text-[10px] font-bold text-primary-dark ring-2 ring-white dark:ring-dark"
                >
                  {index + 1}
                </span>
              </div>
              {/* الاسم وحده: الرقم التعريفي لا يُحتاج هنا — الأستاذ يعرف
                  طلابه بأسمائهم، وقد كان يضيف سطراً ثانياً لكل بطاقة */}
              <span className="truncate text-sm text-gray-800 dark:text-white sm:text-base">
                {student.name}
              </span>
            </div>

            <DoneSwitch
              done={done[student.id] ?? false}
              textClass={switchTextClass}
              onToggle={() => toggle(student.id)}
            />
          </div>
        ))}
      </div>

      {sheet.students.length === 0 && (
        <p className="py-6 text-center text-gray-400 dark:text-gray-500">
          {t("allStudents.noStudents")}
        </p>
      )}

      {save.isError && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {save.error instanceof Error ? save.error.message : t("state.error")}
        </p>
      )}

      {/* حفظ */}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || !canSave}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl
          bg-primary py-3.5 font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        <FaSave />
        {save.isPending ? t("assignmentsPage.saving") : t("assignmentsPage.save")}
      </button>

      {/*
        سطر واحد تحت الزرّ لا ثلاثة: كلٌّ من "سبب التعطيل" و"تمّ الحفظ"
        و"ملاحظة النقاط" كان يحتلّ سطره الخاص، والثلاثة لا يجتمعن في حالة
        واحدة أصلاً. الشرط هنا يُظهر ما يخصّ اللحظة وحده، فيثبت ارتفاع
        الذيل بدل أن يقفز المحتوى عند كل حفظ.
      */}
      <p className="mt-2 min-h-4 text-center text-xs font-semibold">
        {!canSave && sheet.students.length > 0 ? (
          <span className="text-amber-600 dark:text-amber-400">
            {t("assignmentsPage.titleRequired")}
          </span>
        ) : saved ? (
          <span className="text-primary">{t("assignmentsPage.saved")}</span>
        ) : null}
      </p>
    </>
  );
}

/**
 * مفتاح أنجز/لم يُنجز — نظير StatusSwitch في صفحة الحضور.
 *
 * الرمادي لا الأحمر لحالة "لم يُنجز": الغياب مخالفة، وعدمُ إنجاز المقرَّر
 * حالةٌ محايدة قد يكون سببها أن الدور لم يصل الطالبَ بعد.
 */
function DoneSwitch({
  done,
  textClass,
  onToggle,
}: {
  done: boolean;
  textClass: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <label className="relative inline-flex h-8 w-20 cursor-pointer items-center">
      <input type="checkbox" className="sr-only" checked={done} onChange={onToggle} />

      <div
        className={`absolute inset-0 rounded-full shadow-inner transition-colors duration-300 ${
          done ? "bg-primary" : "bg-gray-400 dark:bg-gray-600"
        }`}
      />

      <div
        className={`absolute left-1 top-1 flex h-6 w-10 transform items-center justify-center rounded-full
          bg-white font-bold shadow-md transition-transform duration-300 ${textClass} ${
            done ? "translate-x-8 text-primary" : "translate-x-0 text-gray-500"
          }`}
      >
        {done ? t("assignmentsPage.done") : t("assignmentsPage.notDone")}
      </div>
    </label>
  );
}
