import React, { useState } from "react";
import { FaUser, FaCrown } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { useHalaqat } from "../../lib/api/hooks";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";
import Avatar from "../../shared/Avatar";

type LeaderboardType = "points" | "attendance" | "recitation";

const Reports: React.FC = () => {
  const [type, setType] = useState<LeaderboardType>("points");
  const [halaqaId, setHalaqaId] = useState<number | "">("");
  const { t } = useTranslation();

  const { data: halaqat = [] } = useHalaqat();
  const current = useCurrentHalaqa();

  /**
   * الخادم يرجّع الأعمدة الثلاثة في كل طلب ويرتّب حسب `type`،
   * لذا تبديل التبويب لا يحتاج إلا إعادة الترتيب من الخادم.
   */
  // المدرّس: القوائم والترتيب على طلاب حلقته فقط
  const params = {
    type,
    halaqaId: current.isTeacher ? current.halaqaId : halaqaId === "" ? undefined : halaqaId,
    limit: 50,
  };

  const leaderboard = useQuery({
    queryKey: qk.reports.leaderboard(params),
    queryFn: () => reportsApi.leaderboard(params),
    select: (res) => res.data,
  });

  const students = leaderboard.data ?? [];
  const topThree = students.slice(0, 3);
  const restOfStudents = students.slice(3);

  const label =
    type === "points"
      ? t("leaderboard.labels.totalPoints")
      : type === "attendance"
        ? t("leaderboard.labels.attendance")
        : t("leaderboard.labels.recitation");

  const valueOf = (student: (typeof students)[number]) => {
    if (type === "attendance") return `${student.attendance}%`;
    // التسميع يُقاس بالصفحات: الكسور تظهر كما هي (نصف صفحة، أو وزن سورة قصيرة)
    if (type === "recitation") return t("leaderboard.pagesValue", { pages: student.recitationPages });
    return student.points;
  };

  /** تحت النسبة: كم يوماً حضر من كم يوم دوام — النسبة وحدها لا تُظهر الحجم. */
  const daysOf = (student: (typeof students)[number]) =>
    type === "attendance"
      ? t("leaderboard.attendedOfDays", {
          attended: student.attendedDays,
          days: t("common.days", { count: student.totalDays }),
        })
      : null;

  return (
    <div className="min-h-screen dark:bg-dark-light p-4 md:p-8 dir-rtl text-right font-['Cairo'] pt-20 md:pt-24">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 dark:text-white">
            {t("leaderboard.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-300 mt-1">{t("leaderboard.subtitle")}</p>
        </div>

        {/* فلترة بالحلقة — للمشرف فقط */}
        {current.showHalaqaPicker ? (
        <select
          value={halaqaId}
          onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
          className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark px-4 py-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="">{t("leaderboard.filterHalaqa")}</option>
          {halaqat.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        ) : (
          <span className="rounded-xl bg-emerald-100 px-4 py-2 font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {current.halaqaName}
          </span>
        )}
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

      {leaderboard.isPending ? (
        <LoadingState />
      ) : leaderboard.isError ? (
        <ErrorState error={leaderboard.error} onRetry={() => void leaderboard.refetch()} />
      ) : students.length === 0 ? (
        <EmptyState message={t("leaderboard.empty")} icon="🏆" />
      ) : (
        <>
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
                    {student.avatarUrl ? (
                      <Avatar
                        name={student.name}
                        url={student.avatarUrl}
                        className="size-16 md:size-24 mx-auto"
                        textClassName="text-2xl md:text-3xl"
                      />
                    ) : (
                      <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto">
                        {student.rank === 1 ? (
                          <FaCrown className="text-yellow-400 text-3xl md:text-3xl" />
                        ) : (
                          <FaUser className="text-gray-400 dark:text-gray-300 text-2xl md:text-3xl" />
                        )}
                      </div>
                    )}

                    {/* التاج يبقى ظاهراً فوق صورة صاحب المركز الأول */}
                    {student.rank === 1 && student.avatarUrl && (
                      <FaCrown className="absolute -top-2 left-1/2 -translate-x-1/2 text-lg text-yellow-400 drop-shadow md:text-2xl" />
                    )}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] md:text-xs px-2 py-0.5 rounded-full">
                      #{student.rank}
                    </div>
                  </div>
                  <h2 className="text-[12px] md:text-xl font-bold dark:text-white">
                    {student.name}
                  </h2>
                  <div className="text-xl md:text-3xl font-black text-emerald-400 dark:text-emerald-300 mt-1 md:mt-3">
                    {valueOf(student)}
                  </div>
                  <span className="text-gray-400 dark:text-gray-300 text-[10px] md:text-xs font-bold">
                    {daysOf(student) ?? label}
                  </span>
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
                    className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-dark-light/20 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-gray-400 dark:text-gray-300">
                      {student.rank}
                    </td>
                    <td className="px-6 py-4 font-bold dark:text-white">
                      <div className="flex items-center gap-3">
                        <Avatar name={student.name} url={student.avatarUrl} className="size-9" />
                        <span>{student.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-300">{student.group}</td>
                    <td className="px-6 py-4 text-center font-bold text-emerald-500 dark:text-emerald-400">
                      {valueOf(student)}
                      {daysOf(student) && (
                        <span className="block text-[11px] font-normal text-gray-400 dark:text-gray-500">
                          {daysOf(student)}
                        </span>
                      )}
                    </td>
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
                <div className="relative shrink-0">
                  <Avatar name={student.name} url={student.avatarUrl} className="size-12" />
                  <span
                    className="absolute -top-1 -start-1 flex size-5 items-center justify-center rounded-full
                      bg-gray-100 text-[10px] font-black text-gray-600 ring-2 ring-white
                      dark:bg-gray-700 dark:text-gray-200 dark:ring-dark"
                  >
                    {student.rank}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-sm dark:text-white">{student.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-300">{student.group}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-emerald-500 dark:text-emerald-400 leading-none">
                    {valueOf(student)}
                  </p>
                  <span className="text-[10px] text-gray-400 dark:text-gray-300 font-bold">
                    {daysOf(student) ?? label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
