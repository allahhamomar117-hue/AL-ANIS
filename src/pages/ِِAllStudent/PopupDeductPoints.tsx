import { useState } from "react";
import { useTranslation } from "react-i18next";

type DeductPointsPopupProps = {
  studentName: string;
  initialPoints: number;
  onSave: (points: number, reason: string) => void;
  onClose: () => void;
};

export function PopupDeductPoints({
  studentName,
  initialPoints,
  onSave,
  onClose,
}: DeductPointsPopupProps) {
  const { t } = useTranslation();
  const [points, setPoints] = useState(initialPoints);
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-80 shadow-lg border dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TITLE */}
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4 text-center">
          {t("popupDeductPoints.title")}
        </h2>

        {/* STUDENT */}
        <p className="mb-2 text-gray-700 dark:text-gray-300">
          {t("popupDeductPoints.student")}:
          <span className="font-semibold text-gray-900 dark:text-white">
            {" "}
            {studentName}
          </span>
        </p>

        {/* POINTS */}
        <label className="block mb-2 text-gray-600 dark:text-gray-400">
          {t("popupDeductPoints.amount")}:
        </label>
        <input
          type="number"
          className="w-full border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-dark-light 
          text-gray-800 dark:text-white 
          rounded-xl p-2 mb-4 text-right 
          focus:outline-none focus:ring-2 focus:ring-red-500"
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
        />

        {/* REASON */}
        <label className="block mb-2 text-gray-600 dark:text-gray-400">
          {t("popupDeductPoints.reason")}:
        </label>
        <input
          type="text"
          className="w-full border border-gray-300 dark:border-gray-600 
          bg-white dark:bg-dark-light 
          text-gray-800 dark:text-white 
          rounded-xl p-2 mb-4 text-right 
          focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder={t("popupDeductPoints.reasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 
            bg-gray-200 dark:bg-gray-700 
            text-gray-800 dark:text-white 
            rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            {t("popupDeductPoints.cancel")}
          </button>

          <button
            onClick={() => onSave(points, reason)}
            className="px-4 py-2 
            bg-red-600 text-white 
            rounded-xl hover:bg-red-700 transition"
          >
            {t("popupDeductPoints.save")}
          </button>
        </div>
      </div>
    </div>
  );
}