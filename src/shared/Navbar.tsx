import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "/logo.png";

import {
  FaUsers,
  FaBookOpen,
  FaChartBar,
  FaClipboardCheck,
} from "react-icons/fa";

import SettingsMenu from "./settings/SettingsMenu";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useParams();
  const { t } = useTranslation();

  const isArabic = lang === "ar";

  /* ===== Profile Dropdown ===== */
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ===== Navigation Items ===== */
  const navItems = [
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
  ];

  const isActive = (path: string) => location.pathname.includes(path);

  const userImage = "https://i.pravatar.cc/150?img=3";

  return (
    <div
      className={`fixed top-0 left-0 w-full h-16 z-50 flex items-center justify-between
        px-4 md:px-8 bg-white/90 dark:bg-dark backdrop-blur-md
        border-b border-gray-200 dark:border-gray-700 shadow-sm ${isArabic ? "rtl" : "ltr"}`}
    >
      {/* ===== Logo ===== */}
      <img
        src={logo}
        alt="logo"
        onClick={() => navigate(`/${lang}`)}
        className="w-12 h-12 cursor-pointer"
      />

      {/* ===== Navigation ===== */}
      <div className="flex-1 mx-4 overflow-x-auto scrollbar-hide">
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
                      ? "bg-green-100 text-green-700 border-b-2 border-green-500 dark:bg-green-900/40 dark:text-green-300"
                      : "text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
              >
                <Icon className="text-lg opacity-80" />
                <span className="hidden md:inline">{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Profile ===== */}
      <div ref={profileRef} className="relative">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 px-1 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
        >
          <img
            src={userImage}
            alt="User"
            className="w-8 h-8 rounded-full object-cover border border-gray-300 dark:border-gray-600"
          />
        </button>

        {profileOpen && <SettingsMenu isArabic={isArabic} />}
      </div>
    </div>
  );
}

export default Navbar;
