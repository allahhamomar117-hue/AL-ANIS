import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FaCertificate,
  FaCheck,
  FaPlus,
  FaTimes,
  FaTrashAlt,
  FaUndo,
} from "react-icons/fa";
import {
  useAwqafRecords,
  useDeleteAwqafRecord,
  useUpdateAwqafRecord,
} from "../../lib/api/hooks";
import type { AwqafRecord, AwqafStatus } from "../../lib/api/types";
import { formatMonth } from "../../lib/format/date";
import { AWQAF_STATUSES } from "../../lib/api/types";
import Avatar from "../../shared/Avatar";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";
import { useToast } from "../../shared/toast/toastContext";
import PopupAwqafForm from "./PopupAwqafForm";

/** ألوان الحالة — مصدر واحد للرقاقة ولأزرار الفلترة معاً. */
const STATUS_STYLES: Record<AwqafStatus, string> = {
  nominated:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  passed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/**
 * شهادات وسبر الأوقاف — إدارة المرشّحين لاختبارات وزارة الأوقاف ونتائجهم.
 *
 * للمدير وحده: المسار محميّ بـ RequireManager، وكل مسارات /api/awqaf
 * محصورة بدور ADMIN على الخادم.
 */
export default function AwqafExams() {
  const { t } = useTranslation();
  const { lang = "ar" } = useParams();
  const { notify } = useToast();

  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<AwqafRecord | null>(null);
  const [month, setMonth] = useState<string>("");
  const [status, setStatus] = useState<AwqafStatus | "">("");

  const records = useAwqafRecords({
    month: month || undefined,
    status: status || undefined,
  });
  const update = useUpdateAwqafRecord();
  const remove = useDeleteAwqafRecord();

  const list = records.data?.data ?? [];
  /*
   * الأشهر تأتي من الخادم لا من الصفوف المعروضة: لو اشتُقّت منها لاختفت
   * بقية الخيارات بمجرّد اختيار شهر واحد، فيعلق المستخدم على فلتر لا
   * يستطيع تغييره إلا بإلغائه.
   */
  const months = records.data?.meta.months ?? [];

  const setStatusOf = async (record: AwqafRecord, next: AwqafStatus) => {
    try {
      await update.mutateAsync({ id: record.id, status: next });
      notify(t("awqaf.statusUpdated"));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("state.error"), "error");
    }
  };

  const confirmDelete = async (record: AwqafRecord) => {
    try {
      await remove.mutateAsync(record.id);
      notify(t("awqaf.deleted"));
      setDeleting(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : t("state.error"), "error");
    }
  };

  const chipClass = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-bold transition ${
      active
        ? "bg-emerald-600 text-white shadow"
        : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-dark dark:text-gray-200 dark:hover:bg-gray-700"
    }`;

  return (
    <div
      className="min-h-screen bg-emerald-50/40 pt-20 dark:bg-dark-light md:pt-24"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 md:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-white md:text-4xl">
              <FaCertificate className="text-emerald-600 dark:text-emerald-400" />
              {t("awqaf.title")}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
              {t("awqaf.subtitle")}
            </p>
          </div>

          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white shadow transition hover:bg-emerald-700"
          >
            <FaPlus />
            {t("awqaf.add")}
          </button>
        </header>

        {/* ===== الفلاتر ===== */}
        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-dark">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              {t("awqaf.filterStatus")}
            </span>
            <button onClick={() => setStatus("")} className={chipClass(status === "")}>
              {t("awqaf.all")}
            </button>
            {AWQAF_STATUSES.map((option) => (
              <button
                key={option}
                onClick={() => setStatus(option)}
                className={chipClass(status === option)}
              >
                {t(`awqafStatuses.${option}`)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              {t("awqaf.filterMonth")}
            </span>
            <button onClick={() => setMonth("")} className={chipClass(month === "")}>
              {t("awqaf.allMonths")}
            </button>
            {months.map((option) => (
              <button
                key={option}
                onClick={() => setMonth(option)}
                className={chipClass(month === option)}
              >
                {formatMonth(option)}
              </button>
            ))}
          </div>
        </div>

        {/* ===== الجدول ===== */}
        {records.isPending ? (
          <LoadingState />
        ) : records.isError ? (
          <ErrorState error={records.error} onRetry={() => void records.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState message={t("awqaf.empty")} icon="🎓" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-dark">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-gray-600 dark:bg-dark-light dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{t("awqaf.student")}</th>
                  <th className="px-4 py-3 text-start font-bold">{t("awqaf.halaqa")}</th>
                  <th className="px-4 py-3 text-start font-bold">{t("awqaf.month")}</th>
                  <th className="px-4 py-3 text-start font-bold">{t("awqaf.status")}</th>
                  <th className="px-4 py-3 text-start font-bold">{t("awqaf.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((record) => (
                  <tr
                    key={record.id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={record.studentName}
                          url={record.studentAvatarUrl}
                          className="size-9"
                          textClassName="text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-gray-800 dark:text-white">
                            {record.studentName}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {record.studentCode}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {record.halaqa || t("common.none")}
                    </td>

                    <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                      {formatMonth(record.examMonth)}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[record.status]}`}
                      >
                        {t(`awqafStatuses.${record.status}`)}
                      </span>
                    </td>

                    {/*
                     * الأزرار السريعة تعرض ما ليس مطبَّقاً الآن فقط: زر
                     * "ناجح" على سجلّ ناجح لا يفعل شيئاً، ووجوده يوهم
                     * بإجراء متاح. من نتيجة مسجَّلة يُتاح "إعادة إلى مرشّح"
                     * لتصحيح إدخال خاطئ بلا حذف السجل.
                     */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {record.status !== "passed" && (
                          <button
                            onClick={() => void setStatusOf(record, "passed")}
                            disabled={update.isPending}
                            title={t("awqaf.markPassed")}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-900/20 dark:text-emerald-300"
                          >
                            <FaCheck />
                            {t("awqafStatuses.passed")}
                          </button>
                        )}

                        {record.status !== "failed" && (
                          <button
                            onClick={() => void setStatusOf(record, "failed")}
                            disabled={update.isPending}
                            title={t("awqaf.markFailed")}
                            className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
                          >
                            <FaTimes />
                            {t("awqafStatuses.failed")}
                          </button>
                        )}

                        {record.status !== "nominated" && (
                          <button
                            onClick={() => void setStatusOf(record, "nominated")}
                            disabled={update.isPending}
                            title={t("awqaf.markNominated")}
                            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-dark-light dark:text-gray-200"
                          >
                            <FaUndo />
                            {t("awqafStatuses.nominated")}
                          </button>
                        )}

                        <button
                          onClick={() => setDeleting(record)}
                          title={t("common.delete")}
                          className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-red-100 hover:text-red-700 dark:bg-dark-light dark:text-gray-300"
                        >
                          <FaTrashAlt />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <PopupAwqafForm onClose={() => setAdding(false)} />}

      {deleting && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleting(null)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-red-700 dark:text-red-400">
              {t("awqaf.deleteTitle", { name: deleting.studentName })}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t("awqaf.deleteHint")}
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-xl border border-gray-300 px-5 py-2.5 font-bold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-light"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete(deleting)}
                disabled={remove.isPending}
                className="rounded-xl bg-red-600 px-6 py-2.5 font-bold text-white shadow transition hover:bg-red-700 disabled:opacity-50"
              >
                {remove.isPending ? t("state.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
