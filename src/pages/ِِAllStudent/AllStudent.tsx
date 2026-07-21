import { useState } from "react";
import { MdVisibility, MdEdit, MdDelete } from "react-icons/md";
import { IoPersonAdd } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PopupAddPoints } from "./PopupAddPoints";
import { PopupDeductPoints } from "./PopupDeductPoints";
import { PopupEditStudent } from "./PopupEditStudent";
import { PopupDeleteStudent } from "./PopupDeleteStudent";
import { PopupAddStudent } from "./PopupAddStudent";

type Student = {
  id: string;
  name: string;
  initials: string;
  halaqa: string;
  points: number;
  studentPhone?: string;
  parentPhone?: string;
  birthDate?: string;
};

export default function AllStudent() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [students, setStudents] = useState<Student[]>([
    { id: "2024001", name: "أحمد محمد علي", initials: "أ م", halaqa: "حلقة الفجر", points: 1250 },
    { id: "2024002", name: "محمد عبد الرحمن", initials: "م ع", halaqa: "حلقة العصر", points: 980 },
    { id: "2024003", name: "يوسف خالد", initials: "ي خ", halaqa: "حلقة المغرب", points: 1430 },
    { id: "2024004", name: "عبد الله حسن", initials: "ع ح", halaqa: "حلقة العشاء", points: 760 },
  ]);

  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [popup, setPopup] = useState<null | "add" | "deduct" | "edit" | "delete" | "addStudent">(null);

  /* ===== FILTER STATE ===== */
  const [selectedHalaqa, setSelectedHalaqa] = useState("all");
  const halaqat = Array.from(new Set(students.map((s) => s.halaqa)));
  const filteredStudents = selectedHalaqa === "all" ? students : students.filter((s) => s.halaqa === selectedHalaqa);

  const handleClose = () => {
    setPopup(null);
    setActiveStudent(null);
  };

  const handleSavePoints = (points: number) => {
    if (activeStudent) {
      setStudents((prev) =>
        prev.map((s) => (s.id === activeStudent.id ? { ...s, points } : s))
      );
    }
    handleClose();
  };

  const handleEditStudent = (updatedStudent: Student) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
    );
    handleClose();
  };

  const handleDeleteStudent = () => {
    if (activeStudent) {
      setStudents((prev) => prev.filter((s) => s.id !== activeStudent.id));
    }
    handleClose();
  };

  return (
    <div className="bg-emerald-50/40 dark:bg-dark-light min-h-screen mt-8" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
      <main className="max-w-[1200px] mx-auto px-4 md:px-10 py-10 space-y-8">

        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold mb-2 text-gray-800 dark:text-white">
              {t("allStudents.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">
              {t("allStudents.subtitle")}
            </p>
          </div>

          <button
            onClick={() => setPopup("addStudent")}
            className="flex items-center gap-2 bg-emerald-400 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-bold shadow-lg transition-colors"
          >
            {t("allStudents.addStudentButton")}
            <IoPersonAdd />
          </button>
        </div>

        {/* ===== FILTER (SCROLLABLE) ===== */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <button
            onClick={() => setSelectedHalaqa("all")}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition
              ${
                selectedHalaqa === "all"
                  ? "bg-emerald-500 text-white"
                  : "bg-white dark:bg-dark border dark:border-gray-600 text-emerald-700 dark:text-white hover:bg-emerald-50 dark:hover:bg-dark-light"
              }`}
          >
            {t("allStudents.allStudents")}
          </button>

          {halaqat.map((h) => (
            <button
              key={h}
              onClick={() => setSelectedHalaqa(h)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition
                ${
                  selectedHalaqa === h
                    ? "bg-emerald-500 text-white"
                    : "bg-white dark:bg-dark border dark:border-gray-600 text-emerald-700 dark:text-white hover:bg-emerald-50 dark:hover:bg-dark-light"
                }`}
            >
              {h}
            </button>
          ))}
        </div>

        {/* ===== DESKTOP TABLE ===== */}
        <div className="hidden md:block bg-white dark:bg-dark rounded-2xl border dark:border-gray-600 overflow-hidden">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-emerald-50 dark:bg-dark-light text-emerald-700 dark:text-white text-sm border-b dark:border-gray-600">
                <th className="px-6 py-4 font-bold">{t("allStudents.studentName")}</th>
                <th className="px-6 py-4 font-bold">{t("allStudents.halaqa")}</th>
                <th className="px-6 py-4 font-bold text-left">{t("allStudents.actions")}</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-gray-700">
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-emerald-50/60 dark:hover:bg-dark-light">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-emerald-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-800 dark:text-white">
                        {s.initials}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 dark:text-white">{s.name}</div>
                        <div className="text-xs text-emerald-700/70 dark:text-gray-400">#{s.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-md text-xs bg-emerald-100 dark:bg-gray-700 font-bold text-emerald-700 dark:text-white">
                      {s.halaqa}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <ActionButtons
                      student={s}
                      navigate={navigate}
                      setPopup={setPopup}
                      setActiveStudent={setActiveStudent}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== MOBILE CARDS ===== */}
        <div className="md:hidden space-y-5">
          {filteredStudents.map((s) => (
            <div key={s.id} className="bg-white dark:bg-dark rounded-2xl border dark:border-gray-600 shadow-sm p-4">
              <div className="flex items-center gap-3 pb-3 border-b dark:border-gray-700">
                <div className="size-12 rounded-full bg-emerald-100 dark:bg-gray-700 flex items-center justify-center font-black text-lg text-gray-800 dark:text-white">{s.initials}</div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800 dark:text-white">{s.name}</div>
                  <div className="text-xs text-emerald-700/70 dark:text-gray-400">
                    {t("allStudents.studentNumber")} {s.id}
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-gray-700 text-xs font-bold text-emerald-700 dark:text-white">
                  {s.halaqa}
                </span>
              </div>

              <div className="pt-4">
                <ActionButtons
                  student={s}
                  navigate={navigate}
                  setPopup={setPopup}
                  setActiveStudent={setActiveStudent}
                  small
                />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ===== POPUPS ===== */}
      {popup === "add" && activeStudent && (
        <PopupAddPoints
          studentName={activeStudent.name}
          initialPoints={activeStudent.points}
          onSave={handleSavePoints}
          onClose={handleClose}
        />
      )}
      {popup === "deduct" && activeStudent && (
        <PopupDeductPoints
          studentName={activeStudent.name}
          initialPoints={activeStudent.points}
          onSave={handleSavePoints}
          onClose={handleClose}
        />
      )}
      {popup === "edit" && activeStudent && (
        <PopupEditStudent
          student={activeStudent}
          onSave={handleEditStudent}
          onClose={handleClose}
        />
      )}
      {popup === "delete" && activeStudent && (
        <PopupDeleteStudent
          studentName={activeStudent.name}
          onDelete={handleDeleteStudent}
          onClose={handleClose}
        />
      )}
      {popup === "addStudent" && (
        <PopupAddStudent
          onAdd={(newStudent) => setStudents((prev) => [...prev, newStudent])}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

/* ===== ACTION BUTTONS ===== */
function ActionButtons({
  student,
  navigate,
  setPopup,
  setActiveStudent,
  small,
}: {
  student: Student;
  navigate: any;
  setPopup: (popup: "add" | "deduct" | "edit" | "delete") => void;
  setActiveStudent: (s: Student) => void;
  small?: boolean;
}) {
  const { t } = useTranslation();
  const largeSize = small ? "px-3 py-1 text-sm" : "px-4 py-2 text-sm font-bold";
  const iconSize = small ? "size-8" : "size-9";

  return (
    <div className="flex justify-between gap-2">
      <div className="flex gap-1">
        <button
          onClick={() => navigate(`StudentProfile/${student.id}`)}
          className={`${iconSize} rounded-xl bg-slate-100 dark:bg-gray-700 flex items-center justify-center`}
        >
          <MdVisibility className="text-gray-800 dark:text-white" />
        </button>

        <button
          onClick={() => {
            setActiveStudent(student);
            setPopup("edit");
          }}
          className={`${iconSize} rounded-xl bg-blue-100 dark:bg-blue-700 flex items-center justify-center`}
        >
          <MdEdit className="text-blue-800 dark:text-white" />
        </button>

        <button
          onClick={() => {
            setActiveStudent(student);
            setPopup("delete");
          }}
          className={`${iconSize} rounded-xl bg-red-100 dark:bg-red-700 flex items-center justify-center`}
        >
          <MdDelete className="text-red-800 dark:text-white" />
        </button>
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => {
            setActiveStudent(student);
            setPopup("add");
          }}
          className={`rounded-xl bg-emerald-100 dark:bg-emerald-700 ${largeSize} text-emerald-800 dark:text-white`}
        >
          {t("allStudents.addPoints")}
        </button>

        <button
          onClick={() => {
            setActiveStudent(student);
            setPopup("deduct");
          }}
          className={`rounded-xl bg-fuchsia-100 dark:bg-fuchsia-700 ${largeSize} text-fuchsia-800 dark:text-white`}
        >
          {t("allStudents.deductPoints")}
        </button>
      </div>
    </div>
  );
}
