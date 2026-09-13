import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { useIntensiveHalaqat } from "../../lib/api/useIntensiveHalaqat";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";
import ConfirmDialog from "../../shared/ConfirmDialog";
import { formatDate } from "../../lib/format/date";
import { useToast } from "../../shared/toast/toastContext";

/**
 * سجلّ المقرَّرات السابقة — نظير صفحة "سجل الحضور".
 *
 * لكل يوم بطاقة: عنوان المقرَّر ومَن أنجزه، وزرّان — تعديل يفتح ورقة ذلك
 * اليوم، وحذف يمحو السجلّ ويعيد نقاط كل من أنجزه.
 *
 * ── لماذا لا حذف طالب مفرد كما في سجلّ الحضور؟ ──────────────────────
 * لأن الكتابة صارت طريقاً واحداً: حفظ الورقة كاملة. وإزالة طالب من هنا
 * تعني طريقاً ثانياً إلى الحالة نفسها، وقد أُسقط عمداً في الخادم (راجع
 * رأس routes/assignments.ts). وزرّ "تعديل" يؤدّي الغرض نفسه في خطوة
 * واحدة، وفي الشاشة التي يعرفها الأستاذ أصلاً.
 */
export default function AssignmentsRecords() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const lang = params?.lang || "ar";
  const current = useCurrentHalaqa();
  const { halaqat } = useIntensiveHalaqat();

  const [halaqaId, setHalaqaId] = useState<number | "">("");
  /** السجلّ المرشَّح للحذف — البطاقة كاملة كي تُذكر في نصّ التأكيد. */
  const [pendingDelete, setPendingDelete] = useState<{ id: number; date: string } | null>(null);

  /*
   * المدرّس مقيَّد بحلقته والخادم يفرض ذلك أصلاً، فلا يُرسَل له فلتر.
   * والمشرف يختار من قائمة حلقات المكثفة وحدها — لا معنى لعرض حلقة
   * ابتدائية في فلتر صفحةٍ لا تحمل إلا مقرَّرات.
   */
  const listParams = {
    halaqaId: current.isTeacher ? current.halaqaId : halaqaId === "" ? undefined : halaqaId,
    limit: 30,
  };

  const records = useQuery({
    queryKey: qk.assignments.list(listParams),
    queryFn: () => assignmentsApi.list(listParams),
    select: (res) => res.data,
  });

  const remove = useMutation({
    mutationFn: (id: number) => assignmentsApi.remove(id),
    onSuccess: () => {
      // الحذف يستردّ النقاط، فتتأثر الأرصدة والحلقات والتقارير
      void queryClient.invalidateQueries({ queryKey: qk.assignments.all });
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.halaqat.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
      notify(t("assignmentsRecords.deleted"));
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : t("state.error"), "error"),
    onSettled: () => setPendingDelete(null),
  });

  return (
    <div className="rtl min-h-screen bg-white p-4 pt-20 transition-colors duration-300 dark:bg-dark-light md:pt-24">
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-center text-2xl font-bold text-primary">
          {t("assignmentsRecords.title")}
        </h1>

        {/* فلترة بالحلقة — للمشرف والمدير فقط */}
        {current.showHalaqaPicker && (
          <select
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-800
              focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600
              dark:bg-dark dark:text-white"
          >
            <option value="">{t("assignmentsRecords.selectHalaqa")}</option>
            {halaqat.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        )}

        {records.isPending ? (
          <LoadingState />
        ) : records.isError ? (
          <ErrorState error={records.error} onRetry={() => void records.refetch()} />
        ) : records.data.length === 0 ? (
          <EmptyState message={t("assignmentsRecords.noRecords")} icon="🗓️" />
        ) : (
          records.data.map((record) => (
            <div
              key={record.id}
              className="overflow-hidden rounded-xl border border-primary-light bg-white shadow-sm
                transition-colors duration-300 dark:border-gray-600 dark:bg-dark"
            >
              {/* رأس التاريخ */}
              <div className="flex items-center justify-between gap-2 bg-primary-light px-4 py-3 dark:bg-dark-dark">
                <div className="min-w-0">
                  <p className="font-semibold text-primary-dark dark:text-primary">
                    📅 {t("assignmentsRecords.date")} {formatDate(record.date, i18n.language)}
                  </p>
                  <p className="truncate text-xs text-primary-dark/70 dark:text-primary/70">
                    {record.halaqa}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/${lang}/assignments-groups/${record.halaqaId}?date=${record.date}`
                      )
                    }
                    className="rounded-lg bg-primary px-3 py-1 text-sm text-white transition hover:bg-primary-dark"
                  >
                    {t("assignmentsRecords.edit")}
                  </button>

                  <button
                    onClick={() => setPendingDelete({ id: record.id, date: record.date })}
                    disabled={remove.isPending}
                    className="rounded-lg border border-red-500 px-3 py-1 text-sm text-red-600
                      transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/30"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>

              {/* عنوان المقرَّر */}
              <p className="border-b border-gray-200 px-4 py-3 font-bold text-gray-800 dark:border-gray-700 dark:text-white">
                {record.title}
              </p>

              {/* المنجِزون */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {record.students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800 dark:text-white">
                        {student.name}
                      </p>
                      <span className="text-xs text-gray-400">#{student.code}</span>
                    </div>
                    <span className="shrink-0 text-sm text-primary">
                      ✔ {t("assignmentsPage.done")}
                    </span>
                  </div>
                ))}

                {record.students.length === 0 && (
                  <p className="py-4 text-center text-gray-400 dark:text-gray-500">
                    {t("assignmentsRecords.noCompletions")}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/*
        الحذف يستردّ نقاط كل من أنجز، فهو أوسع أثراً من محو سطر — والتأكيد
        يذكر اليوم صراحةً كي لا يُحذف سجلٌّ بدل آخر.
      */}
      {pendingDelete && (
        <ConfirmDialog
          title={t("assignmentsRecords.confirmDeleteTitle")}
          message={t("assignmentsRecords.confirmDelete", {
            date: formatDate(pendingDelete.date, i18n.language),
          })}
          confirmLabel={t("common.delete")}
          tone="danger"
          onConfirm={() => remove.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
