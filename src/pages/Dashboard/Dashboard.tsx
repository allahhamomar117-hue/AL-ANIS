import { useState, type ReactNode } from "react";
import { FaUsers, FaBookOpen, FaClipboardCheck, FaStar } from "react-icons/fa";

import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { ErrorState, LoadingState } from "../../shared/QueryState";
import { formatDayAndTime } from "../../lib/format/date";

const ACTIVITIES_STEP = 5;

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(ACTIVITIES_STEP);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk.reports.dashboard(),
    queryFn: () => reportsApi.dashboard(),
    select: (res) => res.data,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-dark-light px-4 pb-6 md:p-6 rtl transition-colors duration-300 pt-20 md:pt-24">
      {/* ===== Top Stats ===== */}
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6">
          <StatCard
            title={t("dashboard.stats.halaqas.title")}
            value={`${data.halaqat} ${t("dashboard.stats.halaqas.unit")}`}
            note={t("dashboard.stats.halaqas.note")}
            icon={<FaBookOpen size={24} />}
          />
          <StatCard
            title={t("dashboard.stats.attendance.title")}
            value={`${data.attendanceRate}%`}
            note={`${data.presentToday} ${t("dashboard.stats.attendance.unit")}`}
            icon={<FaClipboardCheck size={24} />}
          />
          <StatCard
            title={t("dashboard.stats.students.title")}
            value={`${data.students} ${t("dashboard.stats.students.unit")}`}
            note={t("dashboard.stats.students.note")}
            icon={<FaUsers size={24} />}
          />
          <StatCard
            title={t("dashboard.stats.recitations.title")}
            value={`${data.recitationsToday} ${t("dashboard.stats.recitations.unit")}`}
            note={t("dashboard.stats.recitations.note")}
            icon={<FaStar size={24} />}
          />
        </div>
      )}

      {/* ===== Recent Activities ===== */}
      <div className="bg-white dark:bg-dark rounded-xl p-6 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          {t("dashboard.recentActivities.title")}
        </h3>

        <hr className="mb-6 border-gray-200 dark:border-gray-600" />

        {data?.recentActivity.length ? (
          data.recentActivity.slice(0, visibleCount).map((activity, index) => (
            <Activity
              key={`${activity.at}-${index}`}
              icon={activity.kind === "recitation" ? <FaBookOpen /> : <FaClipboardCheck />}
              title={
                activity.kind === "recitation"
                  ? t("dashboard.recentActivities.recitation")
                  : t("dashboard.recentActivities.attendance")
              }
              desc={`${activity.student} — ${activity.detail}`}
              time={formatDayAndTime(activity.at, i18n.language)}
            />
          ))
        ) : (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">
            {t("dashboard.recentActivities.empty")}
          </p>
        )}

        {(data?.recentActivity.length ?? 0) > ACTIVITIES_STEP && (
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((c) =>
                  c >= (data?.recentActivity.length ?? 0) ? ACTIVITIES_STEP : c + ACTIVITIES_STEP
                )
              }
              className="px-4 py-2 text-sm font-semibold rounded-lg text-primary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              {visibleCount >= (data?.recentActivity.length ?? 0)
                ? t("dashboard.recentActivities.showLess")
                : t("dashboard.recentActivities.showMore")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Stat Card ===== */

function StatCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
}) {
  return (
    <div
      className="bg-white dark:bg-dark rounded-xl p-6 shadow-sm
                 flex justify-between items-center
                 transition-colors duration-300"
    >
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">{value}</h2>
        <span className="text-primary text-sm">{note}</span>
      </div>
      <div className="text-4xl text-primary">{icon}</div>
    </div>
  );
}

/* ===== Activity Item ===== */

function Activity({
  icon,
  title,
  desc,
  time,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-4 mb-6 last:mb-0">
      <div
        className="w-10 h-10 flex items-center justify-center shrink-0
                   rounded-full bg-primary-light
                   text-primary-dark"
      >
        {icon}
      </div>

      <div className="flex-1">
        <div className="flex justify-between gap-2">
          <h4 className="font-semibold text-gray-800 dark:text-white">{title}</h4>
          <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {time}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{desc}</p>
      </div>
    </div>
  );
}
