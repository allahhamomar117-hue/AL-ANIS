import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft, FaCalendarAlt, FaClipboardList, FaSave } from "react-icons/fa";
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
 * الصفحة مبنية على شكل صفحة الحضور عمداً: عنوانٌ وتاريخ في الأعلى، ثم
 * بطاقة لكل طالب بمفتاح تبديل. من عرف تلك عرف هذه بلا تعلّم.
 *
 * ── الفرق الجوهري عن الحضور: متى يُحفظ؟ ─────────────────────────────
 * الحضور يجمع التعديلات محلياً ثم يحفظها دفعةً بزرّ. والمقرَّرات تُرسل كل
 * تبديل فور وقوعه (تفاؤلياً)، لأن كل إنجاز حركةُ نقاطٍ مستقلّة على
 * الخادم لها مرجعها الخاص — لا حقلٌ في صفّ مشترك. وجمعُها محلياً كان
 * يعني إمّا إعادة حساب النقاط كلها عند كل حفظ، أو خصمَ نقاطٍ ومنحَها في
 * الطلب نفسه.
 *
 * ولهذا لا زرّ "حفظ" للطلاب: الزرّ الوحيد في الصفحة يحفظ عنوان المقرَّر.
 */
export default function AssignmentsPage() {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();

  const halaqaId = Number(params.id);
  const [date, setDate] = useState(todayLocal());

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
        /* المفتاح يعيد تهيئة حقل العنوان عند تبديل الحلقة أو التاريخ،
           فلا حاجة لمزامنته بـ useEffect — نفس نهج صفحة الحضور. */
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

/** ورقة المقرَّر: حقل العنوان ثم قائمة الطلاب. */
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
  const sheetKey = qk.assignments.sheet(halaqaId, date);

  /**
   * ما يُبطَل بعد كل تغيير يمسّ النقاط.
   *
   * ورقة المقرَّر وحدها لا تكفي: الإنجاز يحرّك رصيد الطالب، فتتأثر قوائم
   * الطلاب وبطاقات الحلقات ولوحة الصدارة والتقرير اليومي. وهي نفس
   * المفاتيح التي يُبطلها حفظ الحضور للسبب نفسه.
   */
  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: qk.assignments.all });
    void queryClient.invalidateQueries({ queryKey: qk.students.all });
    void queryClient.invalidateQueries({ queryKey: qk.halaqat.all });
    void queryClient.invalidateQueries({ queryKey: qk.reports.all });
  };

  const saveTitle = useMutation({
    mutationFn: () => assignmentsApi.save({ halaqaId, title: title.trim(), date }),
    onSuccess: () => {
      // الورقة تُعاد قراءتها كي يصل assignmentId فتُفعَّل أزرار الطلاب
      void queryClient.invalidateQueries({ queryKey: qk.assignments.all });
      notify(t("assignmentsPage.saved"));
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : t("state.error"), "error"),
  });

  /**
   * تبديل إنجاز طالب — تفاؤلي.
   *
   * onMutate يكتب الحالة الجديدة في المخزن فوراً فيستجيب المفتاح بلا
   * انتظار الشبكة، ويُرجِع اللقطة السابقة. onError يعيدها كما كانت مع
   * رسالة صريحة: التفاؤل بلا تراجع يترك الشاشة تعلن إنجازاً لم يُسجَّل
   * ونقاطاً لم تُمنح.
   *
   * وإلغاء الاستعلامات الجارية قبل الكتابة ضروري: ردٌّ قديم في الطريق
   * كان يصل بعد الكتابة التفاؤلية فيمحوها ويرتدّ المفتاح أمام عين
   * الأستاذ.
   */
  const toggle = useMutation({
    /*
     * الردّ مُهمَل عمداً (`void`): مساراه يعيدان شكلين مختلفين — قائمة
     * الطلاب عند التسجيل، ولا شيء (204) عند التراجع. وتوحيدهما هنا
     * يُبقي نوع الطفرة واحداً، ولا خسارة فيه: الشاشة تتحدّث من الكتابة
     * التفاؤلية أولاً ثم من إعادة الجلب في onSettled.
     */
    mutationFn: async ({ studentId, done }: { studentId: number; done: boolean }) => {
      if (done) await assignmentsApi.uncomplete(sheet.assignmentId!, studentId);
      else await assignmentsApi.complete(sheet.assignmentId!, studentId);
    },

    onMutate: async ({ studentId, done }) => {
      await queryClient.cancelQueries({ queryKey: sheetKey });
      const previous = queryClient.getQueryData(sheetKey);

      queryClient.setQueryData(sheetKey, (old: { data: AssignmentSheet } | undefined) =>
        old
          ? {
              ...old,
              data: {
                ...old.data,
                students: old.data.students.map((s) =>
                  s.id === studentId
                    ? // القيمة الموجبة مؤقّتة حتى يصل المعرّف الحقيقي:
                      // الواجهة تقرأ الوجود لا القيمة (راجع types.ts)
                      { ...s, completedId: done ? null : -1 }
                    : s
                ),
              },
            }
          : old
      );

      return { previous };
    },

    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(sheetKey, context.previous);
      notify(error instanceof Error ? error.message : t("state.error"), "error");
    },

    onSettled: invalidateAll,
  });

  const doneCount = sheet.students.filter((s) => s.completedId !== null).length;
  const switchTextClass = i18n.language === "en" ? "text-[10px]" : "text-[12px]";

  /** بلا مقرَّر محفوظ لا معنى للتبديل: لا سجلّ يُعلَّق عليه الإنجاز. */
  const locked = sheet.assignmentId === null;

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

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="assignment-title"
            type="text"
            value={title}
            maxLength={200}
            placeholder={t("assignmentsPage.titlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) saveTitle.mutate();
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-800
              focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600
              dark:bg-dark-light dark:text-white"
          />

          <button
            onClick={() => saveTitle.mutate()}
            disabled={saveTitle.isPending || !title.trim() || title.trim() === sheet.title}
            className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary
              px-5 py-2.5 font-semibold text-white transition hover:bg-primary-dark
              disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaSave />
            {saveTitle.isPending ? t("state.saving") : t("assignmentsPage.saveTitle")}
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {locked
            ? t("assignmentsPage.titleRequired")
            : t("assignmentsPage.pointsNotice", { points: sheet.pointsPerCompletion })}
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
      </div>

      {sheet.students.map((student, index) => {
        const done = student.completedId !== null;

        return (
          <div
            key={student.id}
            className={`mb-3 flex items-center justify-between rounded-xl bg-white p-4 shadow
              transition-colors duration-300 dark:bg-dark ${locked ? "opacity-60" : ""}`}
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
                <span className="block truncate text-gray-800 dark:text-white">
                  {student.name}
                </span>
                <span className="block text-xs text-gray-400">#{student.code}</span>
              </div>
            </div>

            <DoneSwitch
              done={done}
              disabled={locked}
              textClass={switchTextClass}
              onToggle={() => toggle.mutate({ studentId: student.id, done })}
            />
          </div>
        );
      })}

      {sheet.students.length === 0 && (
        <p className="py-6 text-center text-gray-400 dark:text-gray-500">
          {t("allStudents.noStudents")}
        </p>
      )}

      <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
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
  disabled,
  textClass,
  onToggle,
}: {
  done: boolean;
  disabled: boolean;
  textClass: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <label
      className={`relative inline-flex h-8 w-20 items-center ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
      title={disabled ? t("assignmentsPage.titleRequired") : undefined}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={done}
        disabled={disabled}
        onChange={onToggle}
      />

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
