import { useState } from "react";
import { useTranslation } from "react-i18next";
import PopupAttendanceRecord from "./PopupAttendanceRecord";

type Student = {
  id: number;
  name: string;
};

type AttendanceDay = {
  date: string;
  students: Student[];
};

export default function AttendanceRecord() {
  const { t } = useTranslation();
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const [attendanceData, setAttendanceData] = useState<AttendanceDay[]>([
    {
      date: "2026-02-01",
      students: [
        { id: 1, name: "أحمد محمد" },
        { id: 2, name: "يوسف علي" },
      ],
    },
    {
      date: "2026-02-02",
      students: [
        { id: 3, name: "عبد الرحمن خالد" },
        { id: 4, name: "عمر حسن" },
      ],
    },
  ]);

  const deleteStudent = (date: string, studentId: number) => {
    setAttendanceData((prev) =>
      prev.map((day) =>
        day.date === date
          ? {
              ...day,
              students: day.students.filter((s) => s.id !== studentId),
            }
          : day
      )
    );
  };

  const addStudentToDate = (studentName: string) => {
    if (!activeDate) return;

    const newStudent: Student = {
      id: Date.now(),
      name: studentName,
    };

    setAttendanceData((prev) =>
      prev.map((day) =>
        day.date === activeDate
          ? { ...day, students: [...day.students, newStudent] }
          : day
      )
    );

    setActiveDate(null);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-light p-4 rtl transition-colors duration-300">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-primary text-center">
          {t("attendanceRecord.title")}
        </h1>

        {attendanceData.map((day) => (
          <div
            key={day.date}
            className="border border-primary-light dark:border-gray-600 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-dark transition-colors duration-300"
          >
            {/* رأس التاريخ */}
            <div className="bg-primary-light dark:bg-dark-dark px-4 py-3 flex items-center justify-between">
              <p className="font-semibold text-primary-dark dark:text-primary">
                📅 {t("attendanceRecord.date")} {day.date}
              </p>

              <button
                onClick={() => setActiveDate(day.date)}
                className="text-sm px-3 py-1 rounded-lg bg-primary text-white hover:bg-primary-dark transition"
              >
                {t("attendanceRecord.addStudent")}
              </button>
            </div>

            {/* قائمة الطلاب */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {day.students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {student.name}
                    </p>
                    <span className="text-sm text-primary">
                      ✔ {t("common.present")}
                    </span>
                  </div>

                  <button
                    onClick={() => deleteStudent(day.date, student.id)}
                    className="text-sm px-3 py-1 rounded-lg 
                    border border-red-500 text-red-600 
                    hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              ))}

              {day.students.length === 0 && (
                <p className="text-center text-gray-400 dark:text-gray-500 py-4">
                  {t("attendanceRecord.empty")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeDate && (
        <PopupAttendanceRecord
          onClose={() => setActiveDate(null)}
          onAdd={addStudentToDate}
        />
      )}
    </div>
  );
}
