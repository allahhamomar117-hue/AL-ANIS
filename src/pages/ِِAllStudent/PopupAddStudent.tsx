import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreateStudent, useHalaqat } from "../../lib/api/hooks";
import { useToast } from "../../shared/toast/toastContext";

type AddStudentPopupProps = {
  onClose: () => void;
  /** الحلقة المختارة مسبقاً (عند الإضافة من داخل حلقة). */
  defaultHalaqaId?: number;
};

export function PopupAddStudent({ onClose, defaultHalaqaId }: AddStudentPopupProps) {
  const { t } = useTranslation();
  const { data: halaqat = [] } = useHalaqat();
  const createStudent = useCreateStudent();
  const { notify } = useToast();

  const [name, setName] = useState("");
  const [halaqaId, setHalaqaId] = useState<number | "">(defaultHalaqaId ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  const handleAdd = async () => {
    if (!name.trim()) return;

    await createStudent.mutateAsync({
      name: name.trim(),
      halaqa_id: halaqaId === "" ? null : halaqaId,
      birth_date: birthDate || null,
      student_phone: studentPhone || null,
      parent_phone: parentPhone || null,
    });

    notify(t("toast.studentAdded"));
    onClose();
  };

  const inputClass =
    "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light text-gray-800 dark:text-white rounded-xl p-3 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-11/12 max-w-md space-y-4 shadow-lg border dark:border-gray-600 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 text-center">
          {t("popupAddStudent.title")}
        </h2>

        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.name")}
          </label>
          <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.birthDate")}
          </label>
          <input
            type="date"
            className={inputClass}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        {/* الحلقة تُختار من الحلقات الموجودة فعلاً في الخادم */}
        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.halaqa")}
          </label>
          <select
            className={inputClass}
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">{t("popupAddStudent.selectHalaqa")}</option>
            {halaqat.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.parentPhone")}
          </label>
          <input
            type="tel"
            className={inputClass}
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
            {t("popupAddStudent.studentPhone")}
          </label>
          <input
            type="tel"
            className={inputClass}
            value={studentPhone}
            onChange={(e) => setStudentPhone(e.target.value)}
          />
        </div>

        {!name.trim() && (
          <p className="text-xs text-gray-400">{t("popupAddStudent.nameRequired")}</p>
        )}

        {createStudent.isError && (
          <p className="text-sm font-bold text-red-600 dark:text-red-400">
            {createStudent.error instanceof Error ? createStudent.error.message : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={createStudent.isPending}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
          >
            {t("popupAddStudent.cancel")}
          </button>

          <button
            onClick={handleAdd}
            disabled={!name.trim() || createStudent.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {createStudent.isPending ? t("popupAddStudent.saving") : t("popupAddStudent.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
