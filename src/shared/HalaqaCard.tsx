import { ArrowLeftIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import type { HalaqaStage } from "../lib/api/types";

interface HalaqaCardProps {
  name: string;
  teacher: string;
  students: number;
  /** المرحلة الدراسية — تُخفى الرقاقة إن لم تُحدَّد. */
  stage?: HalaqaStage | null;
  onClick: () => void;
}

export default function HalaqaCard({ name, teacher, students, stage, onClick }: HalaqaCardProps) {
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
        className="absolute right-0 top-0 h-full w-1.5 bg-gradient-to-b from-emerald-200 to-emerald-500 dark:from-emerald-700 dark:to-emerald-500 rounded-r-2xl"
      />

      {/* خلفية خفيفة عند الهوفر */}
      <div
        className="absolute inset-0 bg-gradient-to-l from-emerald-50 to-transparent dark:from-emerald-900/20 opacity-0 
        group-hover:opacity-100 dark:group-hover:opacity-80 transition"
      />

      <div className="relative z-10">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">{name}</h3>
          {stage && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {t(`halaqaStages.${stage}`)}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-300 mb-5">
          👤 {teacher}
        </p>
        <div className="flex items-center justify-between">
          <span
            /* 700 لا 500: النص الأفتح على خلفية 100 لا يبلغ حدّ التباين AA */
            className="flex items-center gap-2 text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300
            px-4 py-1.5 rounded-full"
          >
            <UserGroupIcon className="w-4 h-4" /> {students} {t("halaqaCard.students")}
          </span>
          <ArrowLeftIcon
            className="w-6 h-6 text-emerald-400 dark:text-emerald-300 transition-transform duration-300 group-hover:-translate-x-1"
          />
        </div>
      </div>
    </div>
  );
}