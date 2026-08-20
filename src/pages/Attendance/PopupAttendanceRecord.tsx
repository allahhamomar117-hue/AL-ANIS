import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { useHalaqaStudents } from "../../lib/api/hooks";
import type { AttendanceSession } from "../../lib/api/types";
import { formatDate } from "../../lib/format/date";

type Props = {
  session: AttendanceSession;
  onClose: () => void;
};

/**
 * إضافة طالب من نفس الحلقة إلى جلسة حضور قائمة.
 * الطلاب المسجّلون في الجلسة مستبعدون من القائمة.
 */
export default function PopupAttendanceRecord({ session, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { data: students = [] } = useHalaqaStudents(session.halaqaId);
  const [selectedStudent, setSelectedStudent] = useState<number | "">("");

  const alreadyIn = new Set(session.students.map((s) => s.studentId));
  const available = students.filter((s) => !alreadyIn.has(s.id));

  const addStudent = useMutation({
    mutationFn: (studentId: number) =>
      attendanceApi.setStatus(session.id, studentId, "present"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.attendance.all });
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 rtl" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark w-full max-w-sm rounded-xl p-5 shadow-lg transition-colors duration-300 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-primary text-center mb-1">
          {t("popupAttendance.title")}
        </h2>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-4">
          {t("popupAttendance.addingTo")}: {formatDate(session.date, i18n.language)} · {session.halaqa}
        </p>

        {/* اختيار الطالب */}
        <div className="mb-4">
          <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">
            {t("popupAttendance.studentLabel")}
          </label>
          <select
            disabled={available.length === 0}
            className="w-full border dark:border-gray-600
            bg-white dark:bg-dark-light
            text-gray-800 dark:text-white
            rounded-lg px-3 py-2
            disabled:bg-gray-100 dark:disabled:bg-dark-dark"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">{t("popupAttendance.selectStudent")}</option>
            {available.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>

          {available.length === 0 && (
            <p className="mt-2 text-xs text-gray-400">{t("popupAttendance.noStudents")}</p>
          )}
        </div>

        {addStudent.isError && (
          <p className="mb-3 text-sm font-bold text-red-600 dark:text-red-400">
            {addStudent.error instanceof Error ? addStudent.error.message : t("state.error")}
          </p>
        )}

        {/* الأزرار */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={addStudent.isPending}
            className="flex-1 border dark:border-gray-600
            rounded-lg py-2
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-dark-dark
            transition disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>

          <button
            disabled={selectedStudent === "" || addStudent.isPending}
            onClick={() => selectedStudent !== "" && addStudent.mutate(selectedStudent)}
            className="flex-1 bg-primary text-white rounded-lg py-2
                       disabled:opacity-50 hover:bg-primary-dark transition"
          >
            {addStudent.isPending ? t("popupAttendance.saving") : t("common.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
