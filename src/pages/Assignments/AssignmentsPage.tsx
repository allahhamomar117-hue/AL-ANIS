import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft, FaCalendarAlt, FaClipboardList, FaHistory, FaSave } from "react-icons/fa";
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
  const { t } = useTranslation();
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
    <div className="rtl min-h-screen bg-white p-6 pt-20 transition-colors duration-300 dark:bg-dark-light md:pt-24">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {t("assignmentsPage.title")}
        </h1>

        <div className="flex items-center gap-2">
          {/*
            منفذ السجلّ من هنا لا من صفحة الاختيار وحدها: المدرّس يُحوَّل
            عنها تلقائياً إلى حلقته، فلو كان الزرّ هناك فقط لما بلغه أبداً.
          */}
          <button
            onClick={() => navigate(`/${lang}/assignments-groups/assignments-record`)}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-primary-light px-2 py-1
              text-sm font-semibold text-primary-dark shadow transition hover:bg-primary
              hover:text-white sm:px-4 sm:py-2 sm:text-base"
          >
            <FaHistory />
            <span>{t("assignmentGroups.recordButton")}</span>
          </button>

          <button
            onClick={() => navigate(backTo)}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-gray-200 px-2 py-1 text-sm
              font-semibold text-gray-700 shadow transition hover:bg-gray-300 dark:bg-dark
              dark:text-white dark:hover:bg-dark-dark sm:px-4 sm:py-2 sm:text-base"
          >
            <FaArrowLeft />
            <span>{isTeacher ? t("common.backHome") : t("assignmentsPage.back")}</span>
          </button>
        </div>
      </div>

      <p className="mb-6 text-gray-500 dark:text-gray-300">
        {t("assignmentsPage.halaqaLabel")}:{" "}
        <span className="font-semibold text-gray-800 dark:text-white">
          {sheet.data?.halaqa.name ?? "…"}
        </span>
      </p>

      <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-4 shadow transition-colors duration-300 dark:bg-dark">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <FaCalendarAlt className="text-primary" />
          <span>{t("assignmentsPage.date")}:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border bg-white px-2 py-1 text-sm text-gray-800 focus:outline-none
              focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-dark-light dark:text-white"
          />
        </div>

        {sheet.data?.recorded && (
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            {t("assignmentsPage.recordedNotice")}
          </span>
        )}
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
      {/* عنوان المقرَّر */}
      <div className="mb-5 rounded-xl bg-white p-4 shadow transition-colors duration-300 dark:bg-dark">
        <label
          htmlFor="assignment-title"
          className="mb-2 flex items-center gap-2 font-bold text-gray-800 dark:text-white"
        >
          <FaClipboardList className="text-primary" />
          {t("assignmentsPage.titleLabel")}
        </label>

        <input
          id="assignment-title"
          type="text"
          value={title}
          maxLength={200}
          placeholder={t("assignmentsPage.titlePlaceholder")}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-800
            focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600
            dark:bg-dark-light dark:text-white"
        />

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t("assignmentsPage.pointsNotice", { points: sheet.pointsPerCompletion })}
        </p>
      </div>

      {/* الطلاب */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-gray-800 dark:text-white">
          {t("assignmentsPage.studentsList")}{" "}
          <span className="text-sm font-medium text-primary">
            ({doneCount}/{sheet.students.length})
          </span>
        </h2>

        <div className="flex gap-2">
          <button
            onClick={() => setAll(true)}
            className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary-dark transition hover:bg-primary hover:text-white"
          >
            {t("assignmentsPage.markAll")}
          </button>
          <button
            onClick={() => setAll(false)}
            className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-300 dark:bg-dark dark:text-gray-200"
          >
            {t("assignmentsPage.clearAll")}
          </button>
        </div>
      </div>

      {sheet.students.map((student, index) => (
        <div
          key={student.id}
          className="mb-3 flex items-center justify-between rounded-xl bg-white p-4 shadow transition-colors duration-300 dark:bg-dark"
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar name={student.name} url={student.avatarUrl} className="size-10" />
              <span
                className="absolute -top-1 -start-1 flex size-5 items-center justify-center rounded-full
                  bg-primary-light text-[10px] font-bold text-primary-dark ring-2 ring-white dark:ring-dark"
              >
                {index + 1}
              </span>
            </div>
            <div className="min-w-0">
              <span className="block truncate text-gray-800 dark:text-white">{student.name}</span>
              <span className="block text-xs text-gray-400">#{student.code}</span>
            </div>
          </div>

          <DoneSwitch
            done={done[student.id] ?? false}
            textClass={switchTextClass}
            onToggle={() => toggle(student.id)}
          />
        </div>
      ))}

      {sheet.students.length === 0 && (
        <p className="py-6 text-center text-gray-400 dark:text-gray-500">
          {t("allStudents.noStudents")}
        </p>
      )}

      {save.isError && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {save.error instanceof Error ? save.error.message : t("state.error")}
        </p>
      )}

      {/* حفظ */}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || !canSave}
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl
          bg-primary py-4 font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        <FaSave />
        {save.isPending ? t("assignmentsPage.saving") : t("assignmentsPage.save")}
      </button>

      {/* سبب التعطيل مكتوب: زرٌّ باهت بلا تفسير يبدو عطلاً في النظام */}
      {!canSave && sheet.students.length > 0 && (
        <p className="mt-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
          {t("assignmentsPage.titleRequired")}
        </p>
      )}

      {saved && (
        <p className="mt-2 text-center text-sm font-bold text-primary">
          {t("assignmentsPage.saved")}
        </p>
      )}

      <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
        {t("assignmentsPage.notice")}
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
