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

type EditStudentPopupProps = {
  student: Student;
  onSave: (updatedStudent: Student) => void;
  onClose: () => void;
};

export function PopupEditStudent({
  student,
  onSave,
  onClose,
}: EditStudentPopupProps) {
  const { t } = useTranslation();

  const [name, setName] = useState(student.name);
  const [halaqa, setHalaqa] = useState(student.halaqa);
  const [birthDate, setBirthDate] = useState(student.birthDate || "");
  const [studentPhone, setStudentPhone] = useState(student.studentPhone || "");
  const [parentPhone, setParentPhone] = useState(student.parentPhone || "");

  const handleSave = () => {
    onSave({
      ...student,
      name,
      halaqa,
      birthDate,
      studentPhone,
      parentPhone,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark rounded-2xl p-6 w-11/12 max-w-md space-y-3 shadow-lg border dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TITLE */}
        <h2 className="text-xl font-bold text-emerald-500 mb-2 text-center">
          {t("popupEditStudent.title")}
        </h2>

        {/* NAME */}
        <InputField
          label={t("popupEditStudent.name")}
          value={name}
          onChange={setName}
        />

        {/* BIRTHDATE */}
        <InputField
          label={t("popupEditStudent.birthDate")}
          value={birthDate}
          onChange={setBirthDate}
        />

        {/* HALAQA */}
        <InputField
          label={t("popupEditStudent.halaqa")}
          value={halaqa}
          onChange={setHalaqa}
        />

        {/* PARENT PHONE */}
        <InputField
          label={t("popupEditStudent.parentPhone")}
          value={parentPhone}
          onChange={setParentPhone}
        />

        {/* STUDENT PHONE */}
        <InputField
          label={t("popupEditStudent.studentPhone")}
          value={studentPhone}
          onChange={setStudentPhone}
        />

        {/* BUTTONS */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            {t("popupEditStudent.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition"
          >
            {t("popupEditStudent.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Reusable Input Component ===== */
function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="text-base font-semibold mb-1 block text-gray-800 dark:text-gray-100">
        {label}
      </label>
      <input
        type="text"
        className="w-full border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-right dark:text-white bg-white dark:bg-dark focus:outline-none focus:ring-2 focus:ring-emerald-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}