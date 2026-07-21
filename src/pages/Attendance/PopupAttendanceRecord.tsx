import { useState } from "react";
import { useTranslation } from "react-i18next";

type Halaqa = {
  id: number;
  name: string;
  students: string[];
};

type Props = {
  onClose: () => void;
  onAdd: (studentName: string) => void;
};

export default function PopupAttendanceRecord({ onClose, onAdd }: Props) {
  const { t } = useTranslation();

  const halaqat: Halaqa[] = [
    {
      id: 1,
      name: "حلقة الفجر",
      students: ["أحمد محمد", "يوسف علي", "عبد الرحمن خالد"],
    },
    {
      id: 2,
      name: "حلقة العصر",
      students: ["عمر حسن", "محمد صالح"],
    },
  ];

  const [selectedHalaqa, setSelectedHalaqa] = useState<Halaqa | null>(null);
  const [selectedStudent, setSelectedStudent] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 rtl">
      <div className="bg-white dark:bg-dark w-full max-w-sm rounded-xl p-5 shadow-lg transition-colors duration-300">
        
        <h2 className="text-xl font-bold text-primary text-center mb-4">
          {t("popupAttendance.title")}
        </h2>

        {/* اختيار الحلقة */}
        <div className="mb-3">
          <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">
            {t("popupAttendance.halaqaLabel")}
          </label>
          <select
            className="w-full border dark:border-gray-600 
            bg-white dark:bg-dark-light 
            text-gray-800 dark:text-white
            rounded-lg px-3 py-2 
            focus:ring-2 focus:ring-primary"
            value={selectedHalaqa?.id ?? ""}
            onChange={(e) => {
              const halaqa = halaqat.find(
                (h) => h.id === Number(e.target.value)
              );
              setSelectedHalaqa(halaqa || null);
              setSelectedStudent("");
            }}
          >
            <option value="">
              {t("popupAttendance.selectHalaqa")}
            </option>
            {halaqat.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        {/* اختيار الطالب */}
        <div className="mb-4">
          <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">
            {t("popupAttendance.studentLabel")}
          </label>
          <select
            disabled={!selectedHalaqa}
            className="w-full border dark:border-gray-600 
            bg-white dark:bg-dark-light 
            text-gray-800 dark:text-white
            rounded-lg px-3 py-2 
            disabled:bg-gray-100 dark:disabled:bg-dark-dark"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            <option value="">
              {t("popupAttendance.selectStudent")}
            </option>
            {selectedHalaqa?.students.map((student) => (
              <option key={student} value={student}>
                {student}
              </option>
            ))}
          </select>
        </div>

        {/* الأزرار */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border dark:border-gray-600 
            rounded-lg py-2 
            text-gray-600 dark:text-gray-300 
            hover:bg-gray-100 dark:hover:bg-dark-dark 
            transition"
          >
            {t("common.cancel")}
          </button>

          <button
            disabled={!selectedStudent}
            onClick={() => {
              onAdd(selectedStudent);
              onClose();
            }}
            className="flex-1 bg-primary text-white rounded-lg py-2 
                       disabled:opacity-50 hover:bg-primary-dark transition"
          >
            {t("common.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
