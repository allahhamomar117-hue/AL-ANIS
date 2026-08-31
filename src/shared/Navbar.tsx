import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../assets/logo.png";

import type { IconType } from "react-icons";
import {
  FaCertificate,
  FaChartLine,
  FaUsers,
  FaBookOpen,
  FaChartBar,
  FaClipboardCheck,
  FaUserCircle,
  FaStar,
  FaFileAlt,
} from "react-icons/fa";

import QuickPointsModal from "./QuickPointsModal";
import DailyReportModal from "./DailyReportModal";
import { useAuth } from "../context/authContext";

/**
 * تبويبات خارج دور المشرف التشغيلي: سجلّات الطلاب، ولوحة الصدارة
 * والإحصاءات العامة. تُحذف من شريطه كلياً — لا تعطيل ولا تظليل.
 */
const SUPERVISOR_HIDDEN = new Set(["students", "reports"]);

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useParams();
  const { t } = useTranslation();

  const isArabic = lang === "ar";
  const { user: me, isSupervisor, canManageUsers } = useAuth();

  const [quickPoints, setQuickPoints] = useState(false);
  const [dailyReport, setDailyReport] = useState(false);

  /* ===== Navigation Items ===== */
  /*
   * صفحة الطلاب للمدير (بكامل الصلاحيات) وللمدرّس (اطّلاع على حلقته).
   * المشرف دوره تشغيلي يومي — تسميع وحضور ونقاط وتقارير — فيُحذف التبويب
   * من شريطه كلياً (لا تعطيل ولا تظليل) تبسيطاً للواجهة، والمسار محميّ
   * بـ RequireStudentManager فلا ينفع الدخول عبر الرابط.
   */
  const navItems: {
    key: string;
    title: string;
    icon: IconType;
    path: string;
    /** تبويب إداري بحت: يظهر للمدير وحده (لا المشرف ولا المدرّس). */
    adminOnly?: boolean;
  }[] = [
    {
      key: "attendance",
      title: t("dashboard.attendance.title"),
      icon: FaClipboardCheck,
      path: "attendance-groups",
    },
    {
      key: "recitation",
      title: t("dashboard.recitation.title"),
      icon: FaBookOpen,
      path: "recitation-groups",
    },
    {
      key: "students",
      title: t("dashboard.students.title"),
      icon: FaUsers,
      path: "all-student",
    },
    {
      key: "reports",
      title: t("dashboard.reports.title"),
      icon: FaChartBar,
      path: "reports",
    },
    {
      key: "statistics",
      title: t("statistics.navTitle"),
      icon: FaChartLine,
      path: "statistics",
      adminOnly: true,
    },
    {
      key: "awqaf",
      title: t("awqaf.navTitle"),
      icon: FaCertificate,
      path: "awqaf",
      adminOnly: true,
    },
  ].filter(
    (item) =>
      !(isSupervisor && SUPERVISOR_HIDDEN.has(item.key)) &&
      !(item.adminOnly && !canManageUsers)
  );

  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <>
      {/* ===== الشريط العلوي ===== */}
      <div
        className={`fixed top-0 left-0 w-full h-16 z-50 flex items-center gap-2
          px-3 md:px-8 bg-white/95 dark:bg-dark backdrop-blur-md
          border-b border-gray-200 dark:border-gray-700 shadow-sm ${
            isArabic ? "rtl" : "ltr"
          }`}
      >
        {/* ===== Logo ===== */}
        <img
          src={logo}
          alt="logo"
          onClick={() => navigate(`/${lang}`)}
          className="h-11 md:h-14 w-auto shrink-0 cursor-pointer object-contain"
        />

        {/* ===== التنقّل — على الشاشات المتوسطة فأكبر فقط ===== */}
        <div className="hidden md:block flex-1 mx-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(`/${lang}/${item.path}`)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition cursor-pointer
                    ${
                      isActive(item.path)
                        ? "bg-emerald-100 text-emerald-700 border-b-2 border-emerald-500 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                >
                  <Icon className="text-lg opacity-80" />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* على الجوال: مساحة مرنة تدفع الأزرار إلى الطرف */}
        <div className="flex-1 md:hidden" />

        {/* ===== نقاط سريعة ===== */}
        <button
          onClick={() => setQuickPoints(true)}
          title={t("quickPoints.title")}
          aria-label={t("quickPoints.button")}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-3 font-bold
            text-white shadow-md transition hover:bg-emerald-600 hover:shadow-lg cursor-pointer active:scale-95"
        >
          <FaStar className="text-lg" />
          <span className="hidden lg:inline">{t("quickPoints.button")}</span>
        </button>

        {/* ===== تقرير اليوم — جاهز للإرسال إلى مجموعة الأهالي ===== */}
        <button
          onClick={() => setDailyReport(true)}
          title={t("dailyReport.title")}
          aria-label={t("dailyReport.button")}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-sky-500 px-3 font-bold
            text-white shadow-md transition hover:bg-sky-600 hover:shadow-lg cursor-pointer active:scale-95"
        >
          <FaFileAlt className="text-lg" />
          <span className="hidden lg:inline">{t("dailyReport.button")}</span>
        </button>

        {/* ===== Profile — نقرة واحدة إلى الإعدادات (اللغة والوضع الليلي والخروج هناك) ===== */}
        <button
          onClick={() => navigate(`/${lang}/settings`)}
          aria-label={t("settings.settings")}
          title={me?.name ?? t("settings.settings")}
          className={`flex h-11 shrink-0 items-center gap-2 rounded-lg px-1 transition cursor-pointer
            active:scale-95 hover:bg-gray-100 dark:hover:bg-gray-800 ${
              isActive("settings") ? "bg-gray-100 dark:bg-gray-800" : ""
            }`}
        >
          <FaUserCircle className="w-8 h-8 text-gray-500 dark:text-gray-400" />
          {me && (
            <span className="hidden text-sm font-semibold text-gray-700 dark:text-gray-200 xl:inline">
              {me.name}
              <span className="ms-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {t(`roles.${me.role}`)}
              </span>
            </span>
          )}
        </button>
      </div>

      {/* ===== شريط التنقّل السفلي — للجوال ===== */}
      <nav
        className={`fixed bottom-0 left-0 z-50 w-full md:hidden
          border-t border-gray-200 bg-white/95 backdrop-blur-md
          pb-[env(safe-area-inset-bottom)] dark:border-gray-700 dark:bg-dark ${
            isArabic ? "rtl" : "ltr"
          }`}
      >
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.key}
                onClick={() => navigate(`/${lang}/${item.path}`)}
                className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2
                  text-[11px] font-semibold transition active:scale-95 ${
                    active
                      ? "text-emerald-600 dark:text-emerald-300"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
              >
                <Icon className={`text-xl ${active ? "" : "opacity-70"}`} />
                <span className="max-w-full truncate">{item.title}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {quickPoints && <QuickPointsModal onClose={() => setQuickPoints(false)} />}
      {dailyReport && <DailyReportModal onClose={() => setDailyReport(false)} />}
    </>
  );
}

export default Navbar;
