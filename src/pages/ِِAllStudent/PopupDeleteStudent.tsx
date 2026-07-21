import { useTranslation } from "react-i18next";

type DeleteStudentPopupProps = {
  studentName: string;
  onDelete: () => void;
  onClose: () => void;
};

export function PopupDeleteStudent({ studentName, onDelete, onClose }: DeleteStudentPopupProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-11/12 max-w-md shadow-lg border dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TITLE */}
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4 text-center">
          {t("popupDeleteStudent.title")}
        </h2>

        {/* CONFIRMATION TEXT */}
        <p className="mb-6 text-center text-gray-800 dark:text-gray-100">
          {t("popupDeleteStudent.confirm")}{" "}
          <span className="font-semibold text-gray-900 dark:text-white">{studentName}</span>?
        </p>

        {/* BUTTONS */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 
            bg-gray-200 dark:bg-gray-700 
            text-gray-800 dark:text-white 
            rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            {t("popupDeleteStudent.cancel")}
          </button>

          <button
            onClick={onDelete}
            className="px-4 py-2 
            bg-red-600 text-white 
            rounded-xl hover:bg-red-700 transition"
          >
            {t("popupDeleteStudent.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}