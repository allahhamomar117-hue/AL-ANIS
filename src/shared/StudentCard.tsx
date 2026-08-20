import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaBookOpen, FaPenAlt } from "react-icons/fa";
import Avatar from "./Avatar";

export interface Student {
  id: string;
  name: string;
  avatarUrl?: string;
  /** نص آخر تسميع جاهزاً للعرض (تاريخ · رقم الصفحة). */
  lastRecitation: string;
  /** لا تسميع سابق: يُعرض النص بالرمادي بدل الكهرماني. */
  hasRecitation?: boolean;
}

interface Props {
  student: Student;
  groupId: string;
  onSelect?: (id: string) => void;
}

/**
 * سطر طالب مدمج في قائمة اختيار التسميع.
 *
 * صُمّم للجوال: ارتفاع السطر ~76px بدل بطاقة بارتفاع ~300px،
 * فتظهر عشرة طلاب في الشاشة بدل واحد.
 */
const StudentCard: React.FC<Props> = ({ student, groupId, onSelect }) => {
  const navigate = useNavigate();
  const params = useParams();
  const { t } = useTranslation();

  /** الزر داخل السطر، فنمنع تكرار التنقّل عند تصاعد الحدث إلى السطر. */
  const handleSelectStudent = (event?: React.MouseEvent) => {
    event?.stopPropagation();

    if (onSelect) onSelect(student.id);

    const lang = params?.lang || "ar";
    navigate(`/${lang}/recitation-groups/${groupId}/students/${student.id}`);
  };

  return (
    <div
      onClick={handleSelectStudent}
      className="flex min-h-[76px] items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm
        transition hover:border-emerald-200 hover:shadow active:scale-[0.99] cursor-pointer
        dark:border-gray-700 dark:bg-dark-light dark:hover:border-emerald-700"
    >
      {/* صورة الطالب أو الحرفان الأولان */}
      <Avatar
        name={student.name}
        url={student.avatarUrl}
        className="size-12"
        textClassName="text-base"
      />

      {/* الاسم وإلى جانبه آخر تسميع — ينزل سطراً عند ضيق الشاشة */}
      <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="truncate text-base md:text-lg font-bold leading-tight text-gray-800 dark:text-white">
          {student.name}
        </h3>
        <p
          className={`flex items-center gap-1.5 text-xs md:text-sm leading-tight ${
            student.hasRecitation
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          <FaBookOpen className="shrink-0 text-sm opacity-70" />
          <span className="truncate">{student.lastRecitation}</span>
        </p>
      </div>

      {/* زر التسجيل — مضغوط على الجوال، بنصّه الكامل على الشاشات الأوسع */}
      <button
        onClick={handleSelectStudent}
        aria-label={t("studentCard.recordRecitation")}
        className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-bold
          text-white shadow-sm transition hover:bg-emerald-600 active:scale-95
          dark:bg-emerald-600 dark:hover:bg-emerald-700"
      >
        <FaPenAlt className="text-sm" />
        <span className="whitespace-nowrap">{t("studentCard.recordRecitation")}</span>
      </button>
    </div>
  );
};

export default StudentCard;
