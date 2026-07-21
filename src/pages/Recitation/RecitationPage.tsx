import StudentCard from "../../shared/StudentCard";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";

type Student = {
  id: string;
  name: string;
  lastRecitation: string;
};

const mockStudents: Student[] = [
  { id: "1", name: "أحمد محمد علي", lastRecitation: "سورة البقرة" },
  { id: "2", name: "عمر خالد", lastRecitation: "سورة آل عمران" },
  { id: "3", name: "يوسف إبراهيم", lastRecitation: "سورة النساء" },
  { id: "4", name: "خالد محمد", lastRecitation: "سورة المائدة" },
  { id: "5", name: "سارة أحمد", lastRecitation: "سورة الرعد" },
  { id: "6", name: "فاطمة علي", lastRecitation: "سورة النحل" },
  { id: "7", name: "محمد حسن", lastRecitation: "سورة الإسراء" },
  { id: "8", name: "أحمد سعيد", lastRecitation: "سورة الكهف" },
];

export default function RecitationPage() {
  const navigate = useNavigate();
  const { id: groupId, lang = "ar" } = useParams();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark p-8 text-right mt-16 rtl transition-colors duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6 gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1
            className={`text-2xl font-black text-gray-800 dark:text-white ${
              i18n.language === "en" ? "text-xl md:text-2xl" : ""
            }`}
          >
            {t("recitationPage.title")}
          </h1>
        </div>

        <button
          onClick={() => navigate(`/${lang}/recitation-groups`)}
          className={`flex items-center gap-1 
            bg-gray-200 dark:bg-dark-light 
            hover:bg-gray-300 dark:hover:bg-dark-dark
            text-gray-700 dark:text-gray-300 
            px-3 py-1 md:px-4 md:py-2 
            rounded-lg font-semibold
            ${i18n.language === "en" ? "text-xs md:text-sm" : "text-sm md:text-base"} 
            shadow transition`}
        >
          <FaArrowLeft />
          <span>{t("recitationPage.back")}</span>
        </button>
      </div>

      <p className="text-gray-500 dark:text-gray-400 mb-6">
        {t("recitationPage.halaqaName", { halaqa: "حلقة النور" })}
      </p>

      {/* Students Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ">
        {mockStudents.map((student) => (
          <StudentCard
            key={student.id}
            student={student}
            groupId={groupId!}
            onSelect={(id) => console.log("Selected:", id)}
          />
        ))}
      </div>
    </div>
  );
}
