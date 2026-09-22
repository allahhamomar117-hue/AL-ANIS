import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FaTrashAlt } from "react-icons/fa";
import PopupAttendanceRecord from "./PopupAttendanceRecord";
import ConfirmDialog from "../../shared/ConfirmDialog";
import { useToast } from "../../shared/toast/toastContext";
import { attendanceApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { useHalaqat } from "../../lib/api/hooks";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";
import { formatDate } from "../../lib/format/date";

export default function AttendanceRecord() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [activeSession, setActiveSession] = useState<number | null>(null);
  /** الجلسة المنتظِرة تأكيد الحذف — خطوة ثانية، فالحذف لا رجعة فيه. */
  const [deleting, setDeleting] = useState<number | null>(null);
  const [halaqaId, setHalaqaId] = useState<number | "">("");

  const { data: halaqat = [] } = useHalaqat();
  const current = useCurrentHalaqa();
  const { notify } = useToast();

  const params = {
    halaqaId: current.isTeacher ? current.halaqaId : halaqaId === "" ? undefined : halaqaId,
    limit: 30,
  };
  const sessions = useQuery({
    queryKey: qk.attendance.sessions(params),
    queryFn: () => attendanceApi.sessions(params),
    select: (res) => res.data,
  });

  /** حذف طالب من جلسة يسترجع نقاط الحضور تلقائياً في الخادم. */
  const removeStudent = useMutation({
    mutationFn: ({ sessionId, studentId }: { sessionId: number; studentId: number }) =>
      attendanceApi.removeStudent(sessionId, studentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.attendance.all });
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
    },
  });

  /**
   * إلغاء يوم الدوام كلّه — للجلسة التي فُتحت بالخطأ.
   *
   * الخادم يحذف الصفّ الأب فتتالى CASCADE على قيود الحضور، ويُرجع نقاط
   * الحضور الممنوحة قبل الحذف (revertPointsFor) — فلا يبقى للطالب رصيد
   * من يوم لم يقع.
   *
   * والإحصاءات تُبطَل معها: حذفُ يومٍ يغيّر متوسط الحضور والمخطّطات، فلو
   * بقيت مخزَّنة لأظهرت الصفحةُ الأخرى اليومَ المحذوف حتى إعادة التحميل.
   */
  const removeSession = useMutation({
    mutationFn: (sessionId: number) => attendanceApi.removeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.attendance.all });
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
      void queryClient.invalidateQueries({ queryKey: qk.statistics.all });
      notify(t("attendanceRecord.sessionDeleted"));
    },
  });

  return (
    <div className="min-h-screen bg-white dark:bg-dark-light p-4 pt-20 md:pt-24 rtl transition-colors duration-300">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-primary text-center">
          {t("attendanceRecord.title")}
        </h1>

        {/* فلترة بالحلقة — للمشرف فقط */}
        {current.showHalaqaPicker && (
        <select
          value={halaqaId}
          onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark px-4 py-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">{t("attendanceRecord.selectHalaqa")}</option>
          {halaqat.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        )}

        {(removeStudent.isError || removeSession.isError) && (
          <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-400">
            {(removeStudent.error ?? removeSession.error) instanceof Error
              ? (removeStudent.error ?? removeSession.error)!.message
              : t("state.error")}
          </p>
        )}

        {sessions.isPending ? (
          <LoadingState />
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : sessions.data.length === 0 ? (
          <EmptyState message={t("attendanceRecord.noSessions")} icon="🗓️" />
        ) : (
          sessions.data.map((session) => (
            <div
              key={session.id}
              className="border border-primary-light dark:border-gray-600 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-dark transition-colors duration-300"
            >
              {/* رأس التاريخ */}
              <div className="bg-primary-light dark:bg-dark-dark px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-primary-dark dark:text-primary">
                    📅 {t("attendanceRecord.date")} {formatDate(session.date, i18n.language)}
                  </p>
                  <p className="text-xs text-primary-dark/70 dark:text-primary/70">
                    {session.halaqa}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setActiveSession(session.id)}
                    className="text-sm px-3 py-1 rounded-lg bg-primary text-white hover:bg-primary-dark transition"
                  >
                    {t("attendanceRecord.addStudent")}
                  </button>

                  {/*
                    أيقونة لا نصّ: الترويسة ضيّقة على الجوال وفيها زرّ
                    نصّي أصلاً، وزرٌّ نصّي ثانٍ بلونٍ مضادّ يزاحمه فيُضغط
                    أحدهما مكان الآخر. والعنوان في title و aria-label.
                  */}
                  <button
                    onClick={() => setDeleting(session.id)}
                    disabled={removeSession.isPending}
                    title={t("attendanceRecord.deleteSession")}
                    aria-label={t("attendanceRecord.deleteSession")}
                    className="rounded-lg border border-red-500 p-2 text-red-600 transition
                      hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/30"
                  >
                    <FaTrashAlt className="text-sm" />
                  </button>
                </div>
              </div>

              {/* قائمة الطلاب */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {session.students.map((student) => {
                  const present = student.status === "present" || student.status === "late";
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {student.name}
                        </p>
                        <span
                          className={`text-sm ${present ? "text-primary" : "text-red-500"}`}
                        >
                          {present ? `✔ ${t("common.present")}` : `✖ ${t("common.absent")}`}
                        </span>
                      </div>

                      <button
                        onClick={() =>
                          removeStudent.mutate({
                            sessionId: session.id,
                            studentId: student.studentId,
                          })
                        }
                        disabled={removeStudent.isPending}
                        className="text-sm px-3 py-1 rounded-lg
                        border border-red-500 text-red-600
                        hover:bg-red-50 dark:hover:bg-red-900/30 transition disabled:opacity-50"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  );
                })}

                {session.students.length === 0 && (
                  <p className="text-center text-gray-400 dark:text-gray-500 py-4">
                    {t("attendanceRecord.empty")}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {activeSession !== null && (
        <PopupAttendanceRecord
          session={sessions.data!.find((s) => s.id === activeSession)!}
          onClose={() => setActiveSession(null)}
        />
      )}

      {/*
        الرسالة تحمل التاريخ وعدد الطلاب: «هل تحذف هذا اليوم؟» وحدها لا
        تكفي حين تتشابه البطاقات، والعدد يقول للمستخدم ما سيفقده فعلاً.
      */}
      {deleting !== null &&
        (() => {
          const session = sessions.data?.find((s) => s.id === deleting);
          if (!session) return null;

          return (
            <ConfirmDialog
              title={t("attendanceRecord.deleteSession")}
              message={t("attendanceRecord.deleteSessionConfirm", {
                date: formatDate(session.date, i18n.language),
                halaqa: session.halaqa,
                count: session.students.length,
              })}
              confirmLabel={t("common.delete")}
              onConfirm={() => {
                removeSession.mutate(deleting);
                setDeleting(null);
              }}
              onCancel={() => setDeleting(null)}
            />
          );
        })()}
    </div>
  );
}
