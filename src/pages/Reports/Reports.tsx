import React, { useMemo, useState } from "react";
import { FaUser, FaCrown } from "react-icons/fa";
import { useTranslation } from "react-i18next";

type LeaderboardType = "points" | "attendance" | "recitation";

interface Student {
  id: number;
  name: string;
  group: string;
  points: number;
  attendance: number;
  recitation: number;
  rank?: number;
}

const studentsData: Student[] = [
  {
    id: 1,
    name: "أحمد محمد",
    group: "حلقة عاصم",
    points: 3120,
    attendance: 98,
    recitation: 95,
  },
  {
    id: 2,
    name: "يوسف علي",
    group: "حلقة البخاري",
    points: 2840,
    attendance: 96,
    recitation: 90,
  },
  {
    id: 3,
    name: "عمر فاروق",
    group: "حلقة ورش",
    points: 2610,
    attendance: 94,
    recitation: 88,
  },
  {
    id: 4,
    name: "زيد خالد",
    group: "حلقة عاصم",
    points: 2450,
    attendance: 92,
    recitation: 85,
  },
  {
    id: 5,
    name: "محمد يحيى",
    group: "حلقة البخاري",
    points: 2410,
    attendance: 90,
    recitation: 87,
  },
  {
    id: 6,
    name: "إبراهيم سعيد",
    group: "حلقة ورش",
    points: 2380,
    attendance: 89,
    recitation: 82,
  },
  {
    id: 7,
    name: "عبد الرحمن نوح",
    group: "حلقة عاصم",
    points: 2320,
    attendance: 93,
    recitation: 89,
  },
];

const Reports: React.FC = () => {
  const [type, setType] = useState<LeaderboardType>("points");
  const { t } = useTranslation();

  const sortedStudents = useMemo(() => {
    return [...studentsData]
      .sort((a, b) => b[type] - a[type])
      .map((s, index) => ({ ...s, rank: index + 1 }));
  }, [type]);

  const topThree = sortedStudents.slice(0, 3);
  const restOfStudents = sortedStudents.slice(3);

  const label =
    type === "points"
      ? t("leaderboard.labels.totalPoints")
      : type === "attendance"
        ? t("leaderboard.labels.attendance")
        : t("leaderboard.labels.recitation");

  return (
<div className="min-h-screen dark:bg-dark-light p-4 md:p-8 dir-rtl text-right font-['Cairo'] mt-14">
  {/* Header */}
  <div className="max-w-6xl mx-auto flex justify-between items-center mb-4">
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-1 dark:text-white">
        {t("leaderboard.title")}
      </h1>
      <p className="text-gray-500 dark:text-gray-300 mt-1">{t("leaderboard.subtitle")}</p>
    </div>
  </div>

  {/* Tabs */}
  <div className="max-w-6xl mx-auto mb-8 bg-white dark:bg-dark border dark:border-gray-700 rounded-xl p-1 shadow-sm">
    <div className="grid grid-cols-3 gap-2">
      {[
        { key: "points", label: t("leaderboard.tabs.points") },
        { key: "attendance", label: t("leaderboard.tabs.attendance") },
        { key: "recitation", label: t("leaderboard.tabs.recitation") },
      ].map((tab) => (
        <button
          key={tab.key}
          onClick={() => setType(tab.key as LeaderboardType)}
          className={`w-full px-6 py-3 rounded-lg font-medium transition
            ${
              type === tab.key
                ? "bg-emerald-400 text-white shadow-md"
                : "text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-light/20"
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>

  {/* Podium */}
  <div className="max-w-5xl mx-auto flex justify-center gap-3 md:gap-6 items-end mb-12 px-2 md:px-4 lg:px-6">
    {topThree.map((student) => (
      <div
        key={student.id}
        className={`bg-white dark:bg-dark rounded-2xl p-3 md:p-6 shadow-xl border-t-4 flex-1
          ${
            student.rank === 1
              ? "border-yellow-400 scale-105 md:scale-110 order-2"
              : student.rank === 2
                ? "border-gray-300 dark:border-gray-500 scale-95 md:scale-100 order-1"
                : "border-orange-400 scale-95 md:scale-100 order-3"
          }`}
      >
        <div className="text-center">
          <div className="relative inline-block mb-2 md:mb-4">
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto">
              {student.rank === 1 ? (
                <FaCrown className="text-yellow-400 text-3xl md:text-3xl" />
              ) : (
                <FaUser className="text-gray-400 dark:text-gray-300 text-2xl md:text-3xl" />
              )}
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] md:text-xs px-2 py-0.5 rounded-full">
              #{student.rank}
            </div>
          </div>
          <h2 className="text-[12px] md:text-xl font-bold dark:text-white">{student.name}</h2>
          <div className="text-xl md:text-3xl font-black text-emerald-400 dark:text-emerald-300 mt-1 md:mt-3">
            {student[type]}
          </div>
          <span className="text-gray-400 dark:text-gray-300 text-[10px] md:text-xs font-bold">{label}</span>
        </div>
      </div>
    ))}
  </div>

  {/* Desktop Table */}
  <div className="hidden md:block max-w-6xl mx-auto bg-white dark:bg-dark-dark rounded-3xl shadow-sm border dark:border-gray-600 overflow-hidden">
    <table className="w-full text-right">
      <thead className="bg-gray-50 dark:bg-dark-light/30">
        <tr className="text-gray-400 dark:text-gray-300 text-sm">
          <th className="px-6 py-4">{t("leaderboard.table.rank")}</th>
          <th className="px-6 py-4">{t("leaderboard.table.name")}</th>
          <th className="px-6 py-4">{t("leaderboard.table.halaqa")}</th>
          <th className="px-6 py-4 text-center">{label}</th>
        </tr>
      </thead>
      <tbody>
        {restOfStudents.map((student) => (
          <tr
            key={student.id}
            className="border-t hover:bg-gray-50 dark:hover:bg-dark-light/20 transition-colors"
          >
            <td className="px-6 py-4 font-bold text-gray-400 dark:text-gray-300">{student.rank}</td>
            <td className="px-6 py-4 font-bold dark:text-white">{student.name}</td>
            <td className="px-6 py-4 text-gray-500 dark:text-gray-300">{student.group}</td>
            <td className="px-6 py-4 text-center font-bold text-emerald-500 dark:text-emerald-400">{student[type]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* Mobile Cards */}
  <div className="md:hidden max-w-6xl mx-auto space-y-3">
    {restOfStudents.map((student) => (
      <div
        key={student.id}
        className="bg-white dark:bg-dark rounded-2xl p-4 shadow border dark:border-gray-700 flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-black text-gray-500 dark:text-gray-300">
          {student.rank}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm dark:text-white">{student.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-300">{student.group}</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-emerald-500 dark:text-emerald-400 leading-none">{student[type]}</p>
          <span className="text-[10px] text-gray-400 dark:text-gray-300 font-bold">{label}</span>
        </div>
      </div>
    ))}
  </div>
</div>
  );
};

export default Reports;
