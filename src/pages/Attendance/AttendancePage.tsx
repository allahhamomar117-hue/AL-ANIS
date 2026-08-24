import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaUserCheck } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import type { AttendanceSheet, AttendanceStatus } from "../../lib/api/types";
import { ErrorState, LoadingState } from "../../shared/QueryState";
import { useToast } from "../../shared/toast/toastContext";
import { todayLocal } from "../../lib/format/date";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import Avatar from "../../shared/Avatar";

export default function AttendancePage() {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();

  const halaqaId = Number(params.id);

  const today = todayLocal();
  const [date, setDate] = useState(today);

  /**
   * وجهة زر العودة.
   *
   * صفحة الحلقات تفتح حلقة المدرّس تلقائياً (Navigate في AttendanceGroups)،
   * فالعودة إليها ترتدّ فوراً إلى هذه الصفحة نفسها ويبدو الزر معطّلاً.
   * المدرّس لا قائمة حلقات له أصلاً، فنعيده إلى الرئيسية.
   */
  const { isTeacher } = useCurrentHalaqa();
  const lang = params?.lang || "ar";
  const backTo = isTeacher ? `/${lang}` : `/${lang}/attendance-groups`;

  const sheet = useQuery({
    queryKey: qk.attendance.sheet(halaqaId, date),
    queryFn: () => attendanceApi.sheet(halaqaId, date),
    select: (res) => res.data,
    enabled: Number.isFinite(halaqaId),
  });

  return (
    <div className="min-h-screen bg-white dark:bg-dark-light p-6 pt-20 md:pt-24 rtl transition-colors duration-300">
      {/* العنوان + زر العودة */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {t("attendancePage.title")}
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(backTo)}
            className="flex items-center gap-1
            bg-gray-200 dark:bg-dark
            hover:bg-gray-300 dark:hover:bg-dark-dark
            text-gray-700 dark:text-white
            px-2 py-1 sm:px-4 sm:py-2 rounded-lg
            font-semibold text-sm sm:text-base
            shadow transition cursor-pointer"
          >
            <FaArrowLeft />
            <span>{isTeacher ? t("common.backHome") : t("attendancePage.back")}</span>
          </button>
        </div>
      </div>

      <p className="text-gray-500 dark:text-gray-300 mb-6">
        {t("attendancePage.halaqaLabel")}:{" "}
        <span className="font-semibold text-gray-800 dark:text-white">
          {sheet.data?.halaqa.name ?? "…"}
        </span>
      </p>

      {/* التاريخ */}
      <div className="bg-white dark:bg-dark rounded-xl p-4 mb-4 flex items-center justify-between shadow transition-colors duration-300">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <FaCalendarAlt className="text-primary" />
          <span>{t("attendancePage.date")}:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border dark:border-gray-600
            bg-white dark:bg-dark-light
            text-gray-800 dark:text-white
            rounded-md px-2 py-1 text-sm
            focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {sheet.data?.recorded && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
            {t("attendancePage.recordedNotice")}
          </span>
        )}
      </div>

      {sheet.isPending ? (
        <LoadingState />
      ) : sheet.isError ? (
        <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
      ) : (
        /* المفتاح يعيد تهيئة النموذج عند تغيّر الحلقة أو التاريخ، فلا حاجة لمزامنته بـ useEffect */
        <AttendanceSheetForm key={`${halaqaId}-${date}`} sheet={sheet.data} halaqaId={halaqaId} date={date} />
      )}
    </div>
  );
}

/** نموذج تسجيل الحضور — حالته المحلية تبدأ من الورقة القادمة من الخادم. */
function AttendanceSheetForm({
  sheet,
  halaqaId,
  date,
}: {
  sheet: AttendanceSheet;
  halaqaId: number;
  date: string;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  /** التعديلات المحلية قبل الحفظ: معرّف الطالب → حالته. */
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>(() =>
    Object.fromEntries(sheet.students.map((s) => [s.id, s.status]))
  );
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      attendanceApi.save({
        halaqaId,
        date,
        // الأستاذ لا يُحضَّر: الحقل باقٍ في العقد على الخادم بقيمة ثابتة
        teacherStatus: "present",
        students: Object.entries(statuses).map(([id, status]) => ({
          id: Number(id),
          status,
        })),
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: qk.attendance.all });
      // الحضور يمنح نقاطاً، فتتأثر أرصدة الطلاب والحلقات والتقارير
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.halaqat.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
      notify(t("attendancePage.saved"));
    },
  });

  const toggleStatus = (id: number, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    setSaved(false);
  };

  const setAll = (status: AttendanceStatus) => {
    setStatuses(Object.fromEntries(sheet.students.map((s) => [s.id, status])));
    setSaved(false);
  };

  const switchTextClass = i18n.language === "en" ? "text-[10px]" : "text-[12px]";

  const presentCount = Object.values(statuses).filter(
    (s) => s === "present" || s === "late"
  ).length;

  return (
    <>
      {/* الطلاب */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-bold text-gray-800 dark:text-white">
          {t("attendancePage.studentsList")}{" "}
          <span className="text-sm font-medium text-primary">
            ({presentCount}/{sheet.students.length})
          </span>
        </h2>

        <div className="flex gap-2">
          <button
            onClick={() => setAll("present")}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary-light text-primary-dark font-semibold hover:bg-primary hover:text-white transition"
          >
            {t("attendancePage.markAll")}
          </button>
          <button
            onClick={() => setAll("absent")}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold hover:bg-red-200 transition"
          >
            {t("attendancePage.clearAll")}
          </button>
        </div>
      </div>

      {sheet.students.map((student, index) => {
        const status = statuses[student.id] ?? "absent";

        return (
          <div
            key={student.id}
            className="bg-white dark:bg-dark rounded-xl p-4 flex items-center justify-between shadow mb-3 transition-colors duration-300"
          >
            <div className="flex items-center gap-3">
              {/* الترتيب صغيراً فوق الصورة: الصورة أسرع في التعرّف على الطالب */}
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

            <StatusSwitch
              present={status === "present" || status === "late"}
              textClass={switchTextClass}
              onToggle={() =>
                toggleStatus(student.id, status === "present" ? "absent" : "present")
              }
            />
          </div>
        );
      })}

      {sheet.students.length === 0 && (
        <p className="text-center text-gray-400 dark:text-gray-500 py-6">
          {t("allStudents.noStudents")}
        </p>
      )}

      {save.isError && (
        <p className="mt-4 rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-400">
          {save.error instanceof Error ? save.error.message : t("state.error")}
        </p>
      )}

      {/* حفظ */}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || sheet.students.length === 0}
        className="mt-6 w-full bg-primary hover:bg-primary-dark cursor-pointer
        text-white py-4 rounded-xl flex items-center justify-center gap-2 font-medium transition disabled:opacity-50"
      >
        <FaUserCheck />
        {save.isPending ? t("attendancePage.saving") : t("attendancePage.save")}
      </button>

      {saved && (
        <p className="mt-2 text-center text-sm font-bold text-primary">
          {t("attendancePage.saved")}
        </p>
      )}

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
        {t("attendancePage.notice")}
      </p>
    </>
  );
}

/** مفتاح حاضر/غائب. */
function StatusSwitch({
  present,
  textClass,
  onToggle,
}: {
  present: boolean;
  textClass: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <label className="relative inline-flex items-center cursor-pointer w-20 h-8">
      <input type="checkbox" className="sr-only" checked={present} onChange={onToggle} />

      <div
        className={`absolute inset-0 rounded-full transition-colors duration-300 shadow-inner ${
          present ? "bg-primary" : "bg-red-500"
        }`}
      />

      <div
        className={`absolute top-1 left-1 w-10 h-6 rounded-full bg-white shadow-md
        flex items-center justify-center font-bold transition-transform duration-300 transform ${textClass} ${
          present ? "translate-x-8 text-primary" : "translate-x-0 text-red-500"
        }`}
      >
        {present ? t("common.present") : t("common.absent")}
      </div>
    </label>
  );
}
