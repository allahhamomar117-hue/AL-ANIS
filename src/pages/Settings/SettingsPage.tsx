import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FaSignOutAlt,
  FaUserCircle,
  FaMoon,
  FaSun,
  FaGlobe,
  FaUsersCog,
  FaLayerGroup,
} from "react-icons/fa";
import { useAuth } from "../../context/authContext";
import { ErrorState, LoadingState } from "../../shared/QueryState";

/** صفحة الإعدادات: بطاقة الحساب (مع تسجيل الخروج) وبطاقة التفضيلات. */
export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang = "ar" } = useParams();

  const { user, isLoading, error, refresh, logout, canManageUsers } = useAuth();

  const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const toggleLanguage = () => {
    const next = lang === "ar" ? "en" : "ar";
    void i18n.changeLanguage(next);
    navigate(location.pathname.replace(`/${lang}`, `/${next}`), { replace: true });
  };

  const handleLogout = () => {
    setLoggingOut(true);
    logout();
    navigate("/login", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-emerald-50/40 dark:bg-dark-light">
        <LoadingState />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-emerald-50/40 dark:bg-dark-light">
        <ErrorState error={error} onRetry={refresh} />
      </div>
    );
  }

  const me = user;

  return (
    <div
      className="min-h-screen bg-emerald-50/40 dark:bg-dark-light pt-20 md:pt-24"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* MainLayout يوفّر عنصر main، فنستخدم div لتفادي تداخل معالم الصفحة */}
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 md:px-8">
        {/* ===== العنوان ===== */}
        <header>
          <h1 className="mb-1 text-2xl font-bold text-gray-800 dark:text-white md:text-4xl">
            {t("settingsPage.title")}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
            {t("settingsPage.subtitle")}
          </p>
        </header>

        {/* ===== بطاقة الحساب ===== */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-dark">
          <h2 className="mb-5 text-lg font-bold text-gray-800 dark:text-white">
            {t("settingsPage.account.title")}
          </h2>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <FaUserCircle className="size-14 shrink-0 text-emerald-500/80 dark:text-emerald-400/80" />

              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-gray-800 dark:text-white">
                  {me.name}
                </p>
                {me.phone_number ? (
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400" dir="ltr">
                    +{me.country_code} {me.phone_number}
                  </p>
                ) : (
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400" dir="ltr">
                    {me.username}
                  </p>
                )}
                <span className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {t(`roles.${me.role}`)}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-bold
                text-white shadow-lg transition hover:bg-red-700 disabled:opacity-60"
            >
              <FaSignOutAlt />
              {t("settingsPage.account.logout")}
            </button>
          </div>
        </section>

        {/* ===== إدارة الكادر — تظهر للمدير وحده ===== */}
        {canManageUsers && (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-dark">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-dark-light dark:text-gray-300">
                  <FaUsersCog />
                </span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {t("staff.title")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("staff.subtitle")}
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate(`/${lang}/staff`)}
                className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white transition hover:bg-emerald-700"
              >
                {t("staff.open")}
              </button>
            </div>
          </section>
        )}

        {/* ===== إدارة الحلقات — تظهر للمدير وحده ===== */}
        {canManageUsers && (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-dark">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-dark-light dark:text-gray-300">
                  <FaLayerGroup />
                </span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {t("halaqatAdmin.title")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("halaqatAdmin.subtitle")}
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate(`/${lang}/halaqat`)}
                className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white transition hover:bg-emerald-700"
              >
                {t("staff.open")}
              </button>
            </div>
          </section>
        )}

        {/* ===== بطاقة التفضيلات ===== */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-dark">
          <h2 className="mb-5 text-lg font-bold text-gray-800 dark:text-white">
            {t("settingsPage.preferences.title")}
          </h2>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* الوضع الليلي */}
            <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-dark-light dark:text-gray-300">
                  {darkMode ? <FaMoon /> : <FaSun />}
                </span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {t("settingsPage.preferences.darkMode")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("settingsPage.preferences.darkModeHint")}
                  </p>
                </div>
              </div>

              {/* مفتاح التبديل */}
              <button
                role="switch"
                aria-checked={darkMode}
                aria-label={t("settingsPage.preferences.darkMode")}
                onClick={() => setDarkMode(!darkMode)}
                className={`relative h-7 w-14 shrink-0 rounded-full transition-colors ${
                  darkMode ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${
                    darkMode ? "start-8" : "start-1"
                  }`}
                />
              </button>
            </div>

            {/* اللغة */}
            <div className="flex items-center justify-between gap-4 py-4 last:pb-0">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-dark-light dark:text-gray-300">
                  <FaGlobe />
                </span>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {t("settingsPage.preferences.language")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {lang === "ar" ? "العربية" : "English"}
                  </p>
                </div>
              </div>

              <button
                onClick={toggleLanguage}
                className="rounded-xl border border-gray-300 px-5 py-2 font-bold text-gray-700 transition
                  hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-dark-light"
              >
                {lang === "ar" ? "English" : "العربية"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
