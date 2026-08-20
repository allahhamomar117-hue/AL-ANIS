import { useState } from "react";
import { useTranslation } from "react-i18next";

type AddPointsPopupProps = {
  studentName: string;
  /** الرصيد الحالي — للعرض فقط. */
  currentPoints: number;
  saving?: boolean;
  /** المقدار المضاف (وليس الرصيد الجديد) والسبب. */
  onSave: (amount: number, reason: string) => void;
  onClose: () => void;
};

export function PopupAddPoints({
  studentName,
  currentPoints,
  saving,
  onSave,
  onClose,
}: AddPointsPopupProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number | "">("");
  const [reason, setReason] = useState("");

  const valid = typeof amount === "number" && amount > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-lg border dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mb-4 text-center">
          {t("popupAddPoints.title")}
        </h2>

        <p className="mb-1 text-gray-700 dark:text-gray-300">
          {t("popupAddPoints.student")}:
          <span className="font-semibold text-gray-900 dark:text-white"> {studentName}</span>
        </p>

        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {t("popupAddPoints.currentBalance")}:
          <span className="font-bold text-emerald-700 dark:text-emerald-400"> {currentPoints}</span>
        </p>

        <label className="block mb-2 text-gray-600 dark:text-gray-400">
          {t("popupAddPoints.amount")}:
        </label>
        <input
          type="number"
          min={1}
          placeholder={t("popupAddPoints.amountHint")}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light text-gray-800 dark:text-white rounded-xl p-2 mb-4 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={amount}
          onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
        />

        <label className="block mb-2 text-gray-600 dark:text-gray-400">
          {t("popupAddPoints.reason")}:
        </label>
        <input
          type="text"
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light text-gray-800 dark:text-white rounded-xl p-2 mb-4 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={t("popupAddPoints.reasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {valid && (
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {currentPoints} + {amount} ={" "}
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {currentPoints + amount}
            </span>
          </p>
        )}

        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
          >
            {t("popupAddPoints.cancel")}
          </button>

          <button
            onClick={() => valid && onSave(amount, reason)}
            disabled={!valid || saving}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {saving ? t("popupAddPoints.saving") : t("popupAddPoints.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
