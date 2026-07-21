import { useState } from "react";
import { useTranslation } from "react-i18next";

type Student = {
  id: string;
  name: string;
  halaqa: string;
  points: number;
  initials: string;
  studentPhone?: string;
  parentPhone?: string;
  birthDate?: string;
};

type AddStudentPopupProps = {
  onAdd: (newStudent: Student) => void;
  onClose: () => void;
};

export function PopupAddStudent({ onAdd, onClose }: AddStudentPopupProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [halaqa, setHalaqa] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");

  const handleAdd = () => {
    const newStudent: Student = {
      id: Date.now().toString(),
      name,
      halaqa,
      birthDate,
      studentPhone,
      parentPhone,
      points: 0,
      initials: name
        .split(" ")
        .map((n) => n[0])
        .join(""),
    };
    onAdd(newStudent);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-11/12 max-w-md space-y-4 shadow-lg border dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TITLE */}
        <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400 text-center">
          {t("popupAddStudent.title")}
        </h2>

        {/* INPUT FIELD COMPONENT STYLE */}
        {[
          {
            label: t("popupAddStudent.name"),
            value: name,
            setValue: setName,
          },
          {
            label: t("popupAddStudent.birthDate"),
            value: birthDate,
            setValue: setBirthDate,
          },
          {
            label: t("popupAddStudent.halaqa"),
            value: halaqa,
            setValue: setHalaqa,
          },
          {
            label: t("popupAddStudent.parentPhone"),
            value: parentPhone,
            setValue: setParentPhone,
          },
          {
            label: t("popupAddStudent.studentPhone"),
            value: studentPhone,
            setValue: setStudentPhone,
          },
        ].map((field, i) => (
          <div key={i}>
            <label className="text-sm font-semibold mb-1 block text-gray-700 dark:text-gray-300">
              {field.label}
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-gray-600 
              bg-white dark:bg-dark-light 
              text-gray-800 dark:text-white 
              rounded-xl p-3 text-right 
              focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={field.value}
              onChange={(e) => field.setValue(e.target.value)}
            />
          </div>
        ))}

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 
            bg-gray-200 dark:bg-gray-700 
            text-gray-800 dark:text-white 
            rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            {t("popupAddStudent.cancel")}
          </button>

          <button
            onClick={handleAdd}
            className="px-4 py-2 
            bg-emerald-600 text-white 
            rounded-xl hover:bg-emerald-700 transition"
          >
            {t("popupAddStudent.add")}
          </button>
        </div>
      </div>
    </div>
  );
}