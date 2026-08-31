import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FaCertificate, FaSearch, FaTimes } from "react-icons/fa";
import { useCreateAwqafRecord, useStudents } from "../../lib/api/hooks";
import { AWQAF_STATUSES, type AwqafStatus } from "../../lib/api/types";
import Avatar from "../../shared/Avatar";
import { useToast } from "../../shared/toast/toastContext";

/** أجزاء المصحف 1..30 — خيارات قائمة الجزء. */
const JUZ_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

/** الشهر الحالي بصيغة YYYY-MM بالتوقيت المحلي (لا UTC، فلا ينزلق الشهر). */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * ترشيح طالب لدورة سبر — للمدير وحده (الخادم يرد 403 لغيره).
 *
 * اختيار الطالب بالبحث لا بقائمة منسدلة: عدد الطلاب يفوق ما تحتمله
 * قائمة واحدة، والمدير يعرف الاسم الذي يبحث عنه.
 */
export default function PopupAwqafForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();

  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState<number | null>(null);
  const [examMonth, setExamMonth] = useState(currentMonth());
  const [status, setStatus] = useState<AwqafStatus>("nominated");
  /** الجزء مطلوب، ويبدأ فارغاً حتى لا يُحفظ جزء لم يختره أحد. */
  const [juz, setJuz] = useState<number | "">("");

  const students = useStudents({
    search: search.trim() || undefined,
    limit: 30,
  });
  const create = useCreateAwqafRecord();

  const list = students.data?.data ?? [];
  const selected = list.find((s) => s.id === studentId) ?? null;

  const valid =
    studentId !== null && juz !== "" && /^\d{4}-\d{2}$/.test(examMonth);

  const submit = async () => {
    if (!valid || create.isPending) return;
    try {
      await create.mutateAsync({
        studentId: studentId!,
        examMonth,
        status,
        juz: juz as number,
      });
      notify(t("awqaf.created"));
      onClose();
    } catch {
      // الرسالة تظهر من كائن الخطأ أسفل النموذج
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light px-4 py-3 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const labelClass =
    "mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-700 dark:text-emerald-400">
            <FaCertificate />
            {t("awqaf.addTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-dark-light"
          >
            <FaTimes />
          </button>
        </div>

        {/* اختيار الطالب */}
        <div>
          <label className={labelClass}>{t("awqaf.student")}</label>

          <div className="relative">
            <FaSearch className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-400 ltr:left-4 rtl:right-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("awqaf.searchStudent")}
              className={`${fieldClass} ltr:pl-11 rtl:pr-11`}
            />
          </div>

          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600">
            {students.isPending ? (
              <p className="p-4 text-center text-sm text-gray-400">
                {t("state.loading")}
              </p>
            ) : list.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-400">
                {t("awqaf.noStudents")}
              </p>
            ) : (
              list.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => setStudentId(student.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-start transition ${
                    student.id === studentId
                      ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : "hover:bg-gray-50 dark:hover:bg-dark-light"
                  }`}
                >
                  <Avatar
                    name={student.name}
                    url={student.avatarUrl}
                    className="size-8"
                    textClassName="text-xs"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-white">
                    {student.name}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                    {student.halaqa || t("common.none")}
                  </span>
                </button>
              ))
            )}
          </div>

          {selected && (
            <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {t("awqaf.selected", { name: selected.name })}
            </p>
          )}
        </div>

        {/* شهر السبر */}
        <div>
          <label className={labelClass}>{t("awqaf.month")}</label>
          <input
            type="month"
            value={examMonth}
            onChange={(e) => setExamMonth(e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* الحالة — الافتراضي "مرشّح"، ويُسمح بتسجيل نتيجة سابقة مباشرةً */}
        <div>
          <label className={labelClass}>{t("awqaf.status")}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AwqafStatus)}
            className={fieldClass}
          >
            {AWQAF_STATUSES.map((option) => (
              <option key={option} value={option}>
                {t(`awqafStatuses.${option}`)}
              </option>
            ))}
          </select>
        </div>

        {/* الجزء المُختبَر — مطلوب: زر الحفظ معطّل حتى يُختار */}
        <div>
          <label className={labelClass}>{t("awqaf.juz")}</label>
          <select
            required
            value={juz}
            onChange={(e) =>
              setJuz(e.target.value === "" ? "" : Number(e.target.value))
            }
            className={fieldClass}
          >
            <option value="">{t("awqaf.juzPlaceholder")}</option>
            {JUZ_OPTIONS.map((number) => (
              <option key={number} value={number}>
                {t("awqaf.juzOption", { number })}
              </option>
            ))}
          </select>
        </div>

        {create.error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {create.error instanceof Error
              ? create.error.message
              : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 px-5 py-2.5 font-bold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-light"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || create.isPending}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {create.isPending ? t("state.saving") : t("awqaf.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
