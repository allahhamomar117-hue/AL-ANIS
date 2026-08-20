import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaEdit, FaPlus, FaTrashAlt, FaUsers } from "react-icons/fa";
import { useDeleteHalaqa, useHalaqat } from "../../lib/api/hooks";
import type { Halaqa } from "../../lib/api/types";
import { ErrorState, LoadingState } from "../../shared/QueryState";
import { useToast } from "../../shared/toast/toastContext";
import PopupHalaqaForm from "./PopupHalaqaForm";

/**
 * إدارة الحلقات — للمدير وحده (المسار محمي بـ RequireManager،
 * ومسارات الإنشاء والتعديل والتعطيل محصورة بدور ADMIN على الخادم).
 *
 * أسماء الحلقات تأتي كلها من القاعدة؛ كل قوائم الاختيار في التطبيق
 * تقرأ من نفس المصدر عبر useHalaqat، فما يُضاف هنا يظهر فيها فوراً.
 */
export default function HalaqatPage() {
  const { t } = useTranslation();
  const { lang = "ar" } = useParams();
  const { notify } = useToast();

  const [form, setForm] = useState<{ editing?: Halaqa } | null>(null);
  const [deactivating, setDeactivating] = useState<Halaqa | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // active=false يرفع الفلترة فتظهر المعطّلة أيضاً
  const halaqat = useHalaqat({ active: !showInactive });
  const remove = useDeleteHalaqa();

  const list = halaqat.data ?? [];
  const activeOthers = list.filter((h) => h.isActive === 1 && h.id !== deactivating?.id);

  const confirmDeactivate = async (target: Halaqa, reassignTo?: number) => {
    try {
      await remove.mutateAsync({ id: target.id, reassignTo });
      notify(t("halaqatAdmin.deactivated"));
      setDeactivating(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : t("state.error"), "error");
    }
  };

  return (
    <div
      className="min-h-screen bg-emerald-50/40 pt-20 dark:bg-dark-light md:pt-24"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 md:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-gray-800 dark:text-white md:text-4xl">
              {t("halaqatAdmin.title")}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
              {t("halaqatAdmin.subtitle")}
            </p>
          </div>

          <button
            onClick={() => setForm({})}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white shadow transition hover:bg-emerald-700"
          >
            <FaPlus />
            {t("halaqatAdmin.add")}
          </button>
        </header>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-4 accent-emerald-600"
          />
          {t("halaqatAdmin.showInactive")}
        </label>

        {halaqat.isPending ? (
          <LoadingState />
        ) : halaqat.isError ? (
          <ErrorState error={halaqat.error} onRetry={() => void halaqat.refetch()} />
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 py-16 text-center text-gray-400 dark:border-gray-600">
            {t("halaqatAdmin.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((halaqa) => (
              <li
                key={halaqa.id}
                className={`flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-dark sm:flex-row sm:items-center sm:justify-between ${
                  halaqa.isActive === 1 ? "" : "opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-gray-800 dark:text-white">
                      {halaqa.name}
                    </p>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <FaUsers className="text-[10px]" />
                      {halaqa.students}
                    </span>
                    {halaqa.isActive !== 1 && (
                      <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {t("halaqatAdmin.inactive")}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                    {halaqa.teacher || t("halaqatAdmin.noTeacher")}
                    {halaqa.stage ? ` · ${t(`halaqaStages.${halaqa.stage}`)}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setForm({ editing: halaqa })}
                    className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-200 dark:bg-dark-light dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <FaEdit />
                    {t("halaqatAdmin.edit")}
                  </button>

                  {halaqa.isActive === 1 && (
                    <button
                      onClick={() => setDeactivating(halaqa)}
                      className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                    >
                      <FaTrashAlt />
                      {t("halaqatAdmin.deactivate")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form && <PopupHalaqaForm editing={form.editing} onClose={() => setForm(null)} />}

      {deactivating && (
        <DeactivateDialog
          halaqa={deactivating}
          targets={activeOthers}
          pending={remove.isPending}
          onCancel={() => setDeactivating(null)}
          onConfirm={(reassignTo) => void confirmDeactivate(deactivating, reassignTo)}
        />
      )}
    </div>
  );
}

/**
 * تأكيد التعطيل. الحلقة التي فيها طلاب فعّالون تفرض اختيار حلقة تُنقل
 * إليها — نفس الشرط الذي يطبّقه الخادم، فلا يبقى طالب بلا حلقة.
 */
function DeactivateDialog({
  halaqa,
  targets,
  pending,
  onCancel,
  onConfirm,
}: {
  halaqa: Halaqa;
  targets: Halaqa[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reassignTo?: number) => void;
}) {
  const { t } = useTranslation();
  const [reassignTo, setReassignTo] = useState<number | "">("");

  const needsReassign = halaqa.students > 0;
  const canConfirm = !pending && (!needsReassign || reassignTo !== "");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-red-700 dark:text-red-400">
          {t("halaqatAdmin.deactivateTitle", { name: halaqa.name })}
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          {needsReassign
            ? t("halaqatAdmin.deactivateWithStudents", { count: halaqa.students })
            : t("halaqatAdmin.deactivateHint")}
        </p>

        {needsReassign &&
          (targets.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {t("halaqatAdmin.noTargetHalaqa")}
            </p>
          ) : (
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-gray-600 dark:bg-dark-light dark:text-white"
            >
              <option value="">{t("halaqatAdmin.chooseTarget")}</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
          ))}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-300 px-5 py-2.5 font-bold text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-light"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reassignTo === "" ? undefined : reassignTo)}
            disabled={!canConfirm}
            className="rounded-xl bg-red-600 px-6 py-2.5 font-bold text-white shadow transition hover:bg-red-700 disabled:opacity-50"
          >
            {t("halaqatAdmin.deactivate")}
          </button>
        </div>
      </div>
    </div>
  );
}
