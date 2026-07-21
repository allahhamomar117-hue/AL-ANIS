import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaUserCheck } from "react-icons/fa";
import { useTranslation } from "react-i18next";

type Student = {
  id: number;
  name: string;
  status: "present" | "absent";
};

export default function AttendancePage() {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();

  const halaqaId = Number(params.id);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  const [teacherStatus, setTeacherStatus] = useState<"present" | "absent">(
    "present"
  );

  const [students, setStudents] = useState<Student[]>([
    { id: 1, name: "أحمد محمد العتيبي", status: "absent" },
    { id: 2, name: "سليمان خالد الرشيد", status: "absent" },
    { id: 3, name: "عبدالله فهد القحطاني", status: "absent" },
    { id: 4, name: "ياسر منصور الحارثي", status: "absent" },
    { id: 5, name: "فيصل عبدالعزيز المطيري", status: "absent" },
  ]);

  const toggleStatus = (id: number, status: "present" | "absent") => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  };

  const handleSave = () => {
    const dataToSend = {
      halaqaId,
      date,
      teacherStatus,
      students,
    };

    console.log("Attendance Data:", dataToSend);
    alert(t("attendancePage.saveAlert"));
  };

  const switchTextClass =
    i18n.language === "en" ? "text-[10px]" : "text-[12px]";

  return (
    <div className="min-h-screen bg-white dark:bg-dark-light p-6 mt-14 rtl transition-colors duration-300">
      
      {/* العنوان + زر العودة */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {t("attendancePage.title")}
        </h1>

        <button
          onClick={() =>
            navigate(`/${params?.lang || "ar"}/attendance-groups`)
          }
          className="flex items-center gap-1 
          bg-gray-200 dark:bg-dark 
          hover:bg-gray-300 dark:hover:bg-dark-dark 
          text-gray-700 dark:text-white
          px-2 py-1 sm:px-4 sm:py-2 rounded-lg 
          font-semibold text-sm sm:text-base 
          shadow transition cursor-pointer"
        >
          <FaArrowLeft />
          <span>{t("attendancePage.back")}</span>
        </button>
      </div>

      <p className="text-gray-500 dark:text-gray-300 mb-6">
        {t("attendancePage.halaqaNumber")}{" "}
        <span className="font-semibold text-gray-800 dark:text-white">
          {halaqaId}
        </span>
      </p>

      {/* التاريخ */}
      <div className="bg-white dark:bg-dark rounded-xl p-4 mb-4 flex items-center justify-between shadow transition-colors duration-300">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <FaCalendarAlt className="text-primary" />
          <span>{t("attendancePage.date")}:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border dark:border-gray-600 
            bg-white dark:bg-dark-light 
            text-gray-800 dark:text-white
            rounded-md px-2 py-1 text-sm 
            focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* حالة الأستاذ */}
      <div className="bg-white dark:bg-dark rounded-xl p-4 mb-6 flex items-center justify-between shadow transition-colors duration-300">
        <div>
          <p className="font-semibold text-gray-800 dark:text-white">
            {t("attendancePage.teacherStatus")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            {t("attendancePage.teacherName")}
          </p>
        </div>

        <label className="relative inline-flex items-center cursor-pointer w-20 h-8">
          <input
            type="checkbox"
            className="sr-only"
            checked={teacherStatus === "present"}
            onChange={() =>
              setTeacherStatus(
                teacherStatus === "present" ? "absent" : "present"
              )
            }
          />

          <div
            className={`absolute inset-0 rounded-full transition-colors duration-300 shadow-inner ${
              teacherStatus === "present"
                ? "bg-primary"
                : "bg-red-500"
            }`}
          />

          <div
            className={`absolute top-1 left-1 w-10 h-6 rounded-full bg-white shadow-md 
            flex items-center justify-center font-bold transition-transform duration-300 transform ${switchTextClass} ${
              teacherStatus === "present"
                ? "translate-x-8 text-primary"
                : "translate-x-0 text-red-500"
            }`}
          >
            {teacherStatus === "present"
              ? t("common.present")
              : t("common.absent")}
          </div>
        </label>
      </div>

      {/* الطلاب */}
      <h2 className="font-bold mb-3 text-gray-800 dark:text-white">
        {t("attendancePage.studentsList")}
      </h2>

      {students.map((student) => (
        <div
          key={student.id}
          className="bg-white dark:bg-dark rounded-xl p-4 flex items-center justify-between shadow mb-3 transition-colors duration-300"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-primary-light text-primary-dark flex items-center justify-center font-bold">
              {student.id}
            </span>
            <span className="text-gray-800 dark:text-white">
              {student.name}
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer w-20 h-8">
            <input
              type="checkbox"
              className="sr-only"
              checked={student.status === "present"}
              onChange={() =>
                toggleStatus(
                  student.id,
                  student.status === "present" ? "absent" : "present"
                )
              }
            />

            <div
              className={`absolute inset-0 rounded-full transition-colors duration-300 shadow-inner ${
                student.status === "present"
                  ? "bg-primary"
                  : "bg-red-500"
              }`}
            />

            <div
              className={`absolute top-1 left-1 w-10 h-6 rounded-full bg-white shadow-md 
              flex items-center justify-center font-bold transition-transform duration-300 transform ${switchTextClass} ${
                student.status === "present"
                  ? "translate-x-8 text-primary"
                  : "translate-x-0 text-red-500"
              }`}
            >
              {student.status === "present"
                ? t("common.present")
                : t("common.absent")}
            </div>
          </label>
        </div>
      ))}

      {/* حفظ */}
      <button
        onClick={handleSave}
        className="mt-6 w-full bg-primary hover:bg-primary-dark cursor-pointer 
        text-white py-4 rounded-xl flex items-center justify-center gap-2 font-medium transition"
      >
        <FaUserCheck />
        {t("attendancePage.save")}
      </button>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
        {t("attendancePage.notice")}
      </p>
    </div>
  );
}
