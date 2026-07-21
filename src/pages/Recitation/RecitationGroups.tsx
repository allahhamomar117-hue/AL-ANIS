import HalaqaGrid from "../../shared/HalaqaGrid";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const halaqat = [
  { id: 1, name: "حلقة الهداية", teacher: "أ. إبراهيم يوسف", students: 20 },
  { id: 2, name: "حلقة التقوى", teacher: "أ. عمر خالد", students: 10 },
  { id: 3, name: "حلقة النور", teacher: "أ. ياسين محمود", students: 15 },
  { id: 4, name: "حلقة الفجر", teacher: "أ. محمد أحمد", students: 12 },
  { id: 5, name: "حلقة الصدق", teacher: "أ. عثمان ناصر", students: 11 },
  { id: 6, name: "حلقة البركة", teacher: "أ. فهد سليمان", students: 25 },
  { id: 7, name: "حلقة الترتيل", teacher: "أ. حسن سعد", students: 18 },
  { id: 8, name: "حلقة الإيمان", teacher: "أ. عبدالله علي", students: 14 },
];

export default function RecitationGroups() {
  const navigate = useNavigate();
  const params = useParams();
  const { t } = useTranslation();

  const handleSelectHalaqa = (id: number) => {
    navigate(`/${params?.lang || "ar"}/recitation-groups/${id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-light px-4 sm:px-8 py-6 mt-14 rtl transition-colors duration-300">
      
      {/* العنوان + زر السجل */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        
        {/* العنوان */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 text-gray-800 dark:text-white">
            {t("recitationGroups.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
            {t("recitationGroups.subtitle")}
          </p>
        </div>

        {/* زر السجل */}
        <button
          onClick={() => navigate("recitation-records")}
          className="
            inline-flex items-center justify-center 
            bg-primary text-white
            px-4 py-2 rounded-lg shadow 
            hover:bg-primary-dark transition
            text-sm sm:text-base w-full sm:w-auto cursor-pointer
          "
        >
          <span className="text-base">
            {t("recitationGroups.recordButton")}
          </span>
        </button>
      </div>

      {/* شبكة الحلقات */}
      <HalaqaGrid
        halaqat={halaqat}
        onSelect={(id) => handleSelectHalaqa(id)}
      />
    </div>
  );
}
