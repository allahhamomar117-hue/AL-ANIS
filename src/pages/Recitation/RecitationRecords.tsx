import { useState } from "react";
import PopupRecitationRegistration from "./PopupRecitationRegistration";
import { useTranslation } from "react-i18next";

type RecitationType = "full" | "half" | "more";

type StudentRecitation = {
  id: number;
  name: string;
  halaqa: string;
  recitationType: RecitationType;
  pageNumber: number;
  verse?: string;
  pageCompleted?: boolean;
  toPage?: number;
};

type RecitationDay = {
  date: string;
  students: StudentRecitation[];
};

export default function RecitationRecords() {
  const { t } = useTranslation();
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const [recitationData, setRecitationData] = useState<RecitationDay[]>([
    {
      date: "2026-02-01",
      students: [
        { id: 1, name: "أحمد محمد", halaqa: "حلقة النور", recitationType: "full", pageNumber: 5 },
        {
          id: 2,
          name: "يوسف علي",
          halaqa: "حلقة الهداية",
          recitationType: "half",
          pageNumber: 3,
          verse: "5",
          pageCompleted: true,
        },
      ],
    },
    {
      date: "2026-02-02",
      students: [
        {
          id: 3,
          name: "عبد الرحمن خالد",
          halaqa: "حلقة التقوى",
          recitationType: "more",
          pageNumber: 2,
          toPage: 4,
        },
      ],
    },
  ]);

  const deleteRecitation = (date: string, studentId: number) => {
    setRecitationData((prev) =>
      prev.map((day) =>
        day.date === date
          ? { ...day, students: day.students.filter((s) => s.id !== studentId) }
          : day
      )
    );
  };

  const addRecitation = (date: string, student: StudentRecitation) => {
    setRecitationData((prev) =>
      prev.map((day) =>
        day.date === date
          ? { ...day, students: [...day.students, student] }
          : day
      )
    );
    setActiveDate(null);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark p-4 transition-colors duration-300">
      <div className="max-w-md mx-auto space-y-6">
        
        <h1 className="text-2xl font-bold text-primary text-center">
          {t("recitationRecords.title")}
        </h1>

        {recitationData.map((day) => (
          <div
            key={day.date}
            className="border border-primary/20 dark:border-primary/30 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-dark-light"
          >
            {/* رأس التاريخ + زر إضافة */}
            <div className="bg-primary/10 dark:bg-primary/20 px-4 py-3 flex items-center justify-between">
              <p className="font-semibold text-primary">
                📅 {day.date}
              </p>

              <button
                onClick={() => setActiveDate(day.date)}
                className="text-sm px-3 py-1 rounded-lg bg-primary text-white hover:bg-primary-dark transition"
              >
                {t("recitationRecords.addButton")}
              </button>
            </div>

            {/* الطلاب */}
            <div className="divide-y dark:divide-gray-700">
              {day.students.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    
                    <p className="font-medium text-gray-800 dark:text-white">
                      {s.name} ({s.halaqa})
                    </p>

                    {s.recitationType === "full" && (
                      <span className="text-sm text-primary">
                        {t("recitationRecords.types.full", { page: s.pageNumber })}
                      </span>
                    )}

                    {s.recitationType === "half" && (
                      <span className="text-sm text-primary flex flex-col sm:flex-row gap-2">
                        {t("recitationRecords.types.half", {
                          page: s.pageNumber,
                          completed: s.pageCompleted
                            ? t("recitationRecords.completed")
                            : t("recitationRecords.notCompleted"),
                          verse: s.verse,
                        })}
                      </span>
                    )}

                    {s.recitationType === "more" && (
                      <span className="text-sm text-primary">
                        {t("recitationRecords.types.more", {
                          from: s.pageNumber,
                          to: s.toPage,
                        })}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => deleteRecitation(day.date, s.id)}
                    className="text-sm px-3 py-1 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    {t("recitationRecords.delete")}
                  </button>
                </div>
              ))}

              {day.students.length === 0 && (
                <p className="text-center text-gray-400 dark:text-gray-500 py-4">
                  {t("recitationRecords.empty")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeDate && (
        <PopupRecitationRegistration
          onClose={() => setActiveDate(null)}
          onAdd={(student) => addRecitation(activeDate, student)}
        />
      )}
    </div>
  );
}
