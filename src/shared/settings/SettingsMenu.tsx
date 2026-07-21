import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaSignOutAlt } from "react-icons/fa";
import PopupLogOut from "./PopupLogOut";
import { useTranslation } from "react-i18next";

type Props = {
  isArabic: boolean;
};

export default function SettingsMenu({ isArabic }: Props) {
  const { lang } = useParams();
  const { t } = useTranslation();
  <h1 className="text-3xl font-black">{t("students.management")}</h1>;
  const navigate = useNavigate();
  const location = useLocation();

  const [openPopupLogOut, setOpenPopupLogOut] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "true",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const toggleLanguage = () => {
    const newLang = lang === "ar" ? "en" : "ar";
    navigate(location.pathname.replace(`/${lang}`, `/${newLang}`));
  };

  return (
    <>
<div
  className={`absolute mt-3 w-56 bg-white dark:bg-dark
    rounded-xl shadow-xl border dark:border-gray-500
    overflow-hidden
    ${isArabic ? "left-0" : "right-0"}`}
>
  <button
    onClick={() => setDarkMode(!darkMode)}
    className="w-full px-4 py-2 flex justify-between 
      text-gray-800 dark:text-white
      hover:bg-gray-100 dark:hover:bg-dark-light"
  >
    <span>{t("settings.darkMode")}</span>
    <span>{darkMode ? "☀️" : "🌙"}</span>
  </button>

  <button
    onClick={toggleLanguage}
    className="w-full px-4 py-2 flex justify-between 
      text-gray-800 dark:text-white
      hover:bg-gray-100 dark:hover:bg-dark-light"
  >
    <span>{t("settings.language")}</span>
    <span>{isArabic ? "EN" : "AR"}</span>
  </button>

  <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

  <button
    onClick={() => setOpenPopupLogOut(true)}
    className="w-full px-4 py-2 flex items-center gap-2 
      text-red-600 dark:text-red-400
      hover:bg-red-100 dark:hover:bg-red-900/30"
  >
    <FaSignOutAlt />
    {t("settings.logout")}
  </button>
</div>

      <PopupLogOut
        openPopupLogOut={openPopupLogOut}
        setOpenPopupLogOut={setOpenPopupLogOut}
      />
    </>
  );
}
