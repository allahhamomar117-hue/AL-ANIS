import {
  FaUsers,
  FaBookOpen,
  FaChartBar,
  FaStar,
  FaBullhorn,
  FaUserPlus,
  FaClipboardCheck,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const cards = [
    {
      key: "attendance",
      title: t("dashboard.attendance.title"),
      subtitle: t("dashboard.attendance.subtitle"),
      icon: FaClipboardCheck,
      path: "attendance-groups",
    },
    {
      key: "recitation",
      title: t("dashboard.recitation.title"),
      subtitle: t("dashboard.recitation.subtitle"),
      icon: FaBookOpen,
      path: "recitation-groups",
    },
    {
      key: "students",
      title: t("dashboard.students.title"),
      subtitle: t("dashboard.students.subtitle"),
      icon: FaUsers,
      path: "all-student",
    },
    {
      key: "reports",
      title: t("dashboard.reports.title"),
      subtitle: t("dashboard.reports.subtitle"),
      icon: FaChartBar,
      path: "reports",
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-dark-light p-6 rtl transition-colors duration-300 mt-14">
      {/* ===== Top Stats ===== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6">
        <StatCard
          title={t("dashboard.stats.halaqas.title")}
          value={t("dashboard.stats.halaqas.value")}
          note={t("dashboard.stats.halaqas.note")}
          icon={<FaBookOpen size={24} />}
        />
        <StatCard
          title={t("dashboard.stats.attendance.title")}
          value={t("dashboard.stats.attendance.value")}
          note={t("dashboard.stats.attendance.note")}
          icon={<FaUsers size={24} />}
        />
      </div>

      {/* ===== Services ===== */}
      <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
        {t("dashboard.title")}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              onClick={() => navigate(card.path)}
              className="cursor-pointer bg-white dark:bg-dark 
                         rounded-xl p-5 shadow-sm
                         hover:shadow-lg hover:-translate-y-1 
                         transition-all duration-300"
            >
              <div className="text-3xl text-primary mb-2">
                <Icon />
              </div>
              <h2 className="font-bold text-gray-800 dark:text-white">
                {card.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-300">
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* ===== Recent Activities ===== */}
      <div className="bg-white dark:bg-dark rounded-xl p-6 shadow-sm transition-colors duration-300">
        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          {t("dashboard.recentActivities.title")}
        </h3>

        <hr className="mb-6 border-gray-200 dark:border-gray-600" />

        <Activity
          icon={<FaUserPlus />}
          title={t("dashboard.recentActivities.newStudent.title")}
          desc={t("dashboard.recentActivities.newStudent.desc")}
          time={t("dashboard.recentActivities.newStudent.time")}
        />

        <Activity
          icon={<FaStar />}
          title={t("dashboard.recentActivities.achievement.title")}
          desc={t("dashboard.recentActivities.achievement.desc")}
          time={t("dashboard.recentActivities.achievement.time")}
        />

        <Activity
          icon={<FaBullhorn />}
          title={t("dashboard.recentActivities.initiative.title")}
          desc={t("dashboard.recentActivities.initiative.desc")}
          time={t("dashboard.recentActivities.initiative.time")}
        />
      </div>
    </div>
  );
}

/* ===== Stat Card ===== */

function StatCard({ title, value, note, icon }) {
  return (
    <div
      className="bg-white dark:bg-dark rounded-xl p-6 shadow-sm 
                 flex justify-between items-center
                 transition-colors duration-300"
    >
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {title}
        </p>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">
          {value}
        </h2>
        <span className="text-primary text-sm">{note}</span>
      </div>
      <div className="text-4xl text-primary">
        {icon}
      </div>
    </div>
  );
}

/* ===== Activity Item ===== */

function Activity({ icon, title, desc, time }) {
  return (
    <div className="flex items-start gap-4 mb-6 last:mb-0">
      <div
        className="w-10 h-10 flex items-center justify-center 
                   rounded-full bg-primary-light 
                   text-primary-dark"
      >
        {icon}
      </div>

      <div className="flex-1">
        <div className="flex justify-between">
          <h4 className="font-semibold text-gray-800 dark:text-white">
            {title}
          </h4>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {time}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {desc}
        </p>
      </div>
    </div>
  );
}
