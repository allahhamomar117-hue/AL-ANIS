import { ArrowLeftIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

interface HalaqaCardProps {
  name: string;
  teacher: string;
  students: number;
  onClick: () => void;
}

export default function HalaqaCard({ name, teacher, students, onClick }: HalaqaCardProps) {
  const { t } = useTranslation();

  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden 
      bg-white/80 dark:bg-dark backdrop-blur rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm 
      hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
    >
      {/* الخط الجانبي */}
      <div
        className="absolute right-0 top-0 h-full w-1.5 bg-gradient-to-b from-green-200 to-green-500 dark:from-green-700 dark:to-green-500 rounded-r-2xl"
      />

      {/* خلفية خفيفة عند الهوفر */}
      <div
        className="absolute inset-0 bg-gradient-to-l from-green-50 to-transparent dark:from-green-900/20 opacity-0 
        group-hover:opacity-100 dark:group-hover:opacity-80 transition"
      />

      <div className="relative z-10">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">{name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-300 mb-5">
          👤 {teacher}
        </p>
        <div className="flex items-center justify-between">
          <span
            className="flex items-center gap-2 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-500 dark:text-green-400 
            px-4 py-1.5 rounded-full"
          >
            <UserGroupIcon className="w-4 h-4" /> {students} {t("halaqaCard.students")}
          </span>
          <ArrowLeftIcon
            className="w-6 h-6 text-green-400 dark:text-green-300 transition-transform duration-300 group-hover:-translate-x-1"
          />
        </div>
      </div>
    </div>
  );
}