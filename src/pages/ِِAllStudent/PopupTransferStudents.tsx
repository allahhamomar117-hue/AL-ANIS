import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Halaqa } from "../../lib/api/types";

type TransferStudentsPopupProps = {
  /** عدد الطلاب المحدَّدين — يظهر في نص التأكيد. */
  count: number;
  halaqat: Halaqa[];
  transferring?: boolean;
  /** خطأ النقل القادم من الخادم — يُعرض داخل النافذة بدل إغلاقها بصمت. */
  error?: unknown;
  onTransfer: (halaqaId: number) => void;
  onClose: () => void;
};

export function PopupTransferStudents({
  count,
  halaqat,
  transferring,
  error,
  onTransfer,
  onClose,
}: TransferStudentsPopupProps) {
  const { t } = useTranslation();
  const [halaqaId, setHalaqaId] = useState<number | "">("");

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-11/12 max-w-md shadow-lg border dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-4 text-center">
          {t("popupTransferStudents.title")}
        </h2>

        <p className="mb-6 text-center text-gray-800 dark:text-gray-100">
          {t("popupTransferStudents.confirm", { count })}
        </p>

        <label className="block mb-2 text-sm font-bold text-gray-700 dark:text-gray-200">
          {t("popupTransferStudents.destination")}
        </label>
        <select
          value={halaqaId}
          onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
          disabled={transferring}
          className="w-full min-h-[48px] mb-6 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark px-4 py-3 text-base text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
        >
          <option value="">{t("popupTransferStudents.choose")}</option>
          {halaqat.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        {error != null && (
          <p className="mb-4 text-center text-sm font-bold text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={transferring}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => halaqaId !== "" && onTransfer(halaqaId)}
            disabled={transferring || halaqaId === ""}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition disabled:opacity-50"
          >
            {transferring ? t("state.loading") : t("popupTransferStudents.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
