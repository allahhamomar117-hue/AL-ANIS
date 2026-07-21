import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

export interface Student {
  id: string;
  name: string;
  avatarUrl?: string;
  lastRecitation: string;
  initials?: string;
}

interface Props {
  student: Student;
  groupId: string;
  onSelect?: (id: string) => void;
}

const StudentCard: React.FC<Props> = ({ student, groupId, onSelect }) => {
  const navigate = useNavigate();
  const params = useParams();
  const { t } = useTranslation();

  const handleSelectStudent = () => {
    if (onSelect) onSelect(student.id);

    const lang = params?.lang || "ar";
    navigate(`/${lang}/recitation-groups/${groupId}/students/${student.id}`);
  };

  return (
    <div
      onClick={handleSelectStudent}
      className="bg-white dark:bg-dark-light rounded-2xl p-6 shadow-sm flex flex-col items-center text-center border
        border-gray-50 dark:border-gray-700 transition-transform hover:shadow-md hover:-translate-y-1 cursor-pointer
        transition-colors duration-300"
    >
      {/* صورة الطالب أو الحروف الأولى */}
      <div className="relative mb-4">
        {student.avatarUrl ? (
          <img
            src={student.avatarUrl}
            alt={student.name}
            className="w-24 h-24 rounded-full object-cover bg-orange-100 dark:bg-orange-200"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-700 flex items-center justify-center
              text-emerald-600 dark:text-emerald-200 text-2xl font-bold"
          >
            {student.initials || student.name.split(" ").map(n => n[0]).join("")}
          </div>
        )}
      </div>

      {/* اسم الطالب */}
      <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">{student.name}</h3>

      {/* آخر تسميع */}
      <p className="text-sm text-gray-500 dark:text-gray-300 mb-6">
        <span className="ml-1">📖</span> {t("studentCard.lastRecitation")}: {student.lastRecitation}
      </p>

      {/* زر تسجيل التسميع */}
      <button
        onClick={handleSelectStudent}
        className="w-full bg-emerald-400 dark:bg-emerald-600 hover:bg-emerald-500 dark:hover:bg-emerald-700 
          text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-xl">📄</span>
        {t("studentCard.recordRecitation")}
      </button>
    </div>
  );
};

export default StudentCard;