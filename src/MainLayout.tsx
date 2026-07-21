import { Outlet, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "./shared/Navbar";

const MainLayout = () => {
  const { lang } = useParams(); // ar | en
  const { i18n } = useTranslation();

  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }

    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
  }, [lang, i18n]);

  return (
    <div className="flex flex-col min-h-screen ">
           <Navbar />

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
