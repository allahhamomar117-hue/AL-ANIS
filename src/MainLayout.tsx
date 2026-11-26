import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useEffect, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "./shared/Navbar";
import { useAuth } from "./context/authContext";
import DemoBanner from "./demo/DemoBanner";
import { getDemoSnapshot, subscribeDemoStore } from "./demo/demoStore";

/** الهيكل العام للصفحات المحمية. الحارس مطبَّق على مستوى المسار في MainRoutes. */
const MainLayout = () => {
  const { lang } = useParams(); // ar | en
  const { i18n } = useTranslation();
  const { isViewer } = useAuth();
  const demo = useSyncExternalStore(
    subscribeDemoStore,
    getDemoSnapshot,
    getDemoSnapshot,
  );
  const location = useLocation();
  const isDemoTv =
    demo.isDemoMode &&
    location.pathname.endsWith("/reports") &&
    new URLSearchParams(location.search).get("tv") === "1";
  const showDemoBanner = demo.isDemoMode && !isDemoTv;

  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }

    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
  }, [lang, i18n]);

  /*
   * حساب شاشة العرض لا يرى إلا لوحة الصدارة: أي مسار آخر (الرئيسية بعد
   * الدخول، أو رابط كُتب يدوياً) يُحوَّل إليها قبل أن تُحمَّل صفحته — فلا
   * تُطلق صفحةٌ طلباتٍ يردّها الخادم بـ403 على الشاشة أمام الطلاب.
   */
  if (isViewer && !location.pathname.endsWith("/reports")) {
    return <Navigate to={`/${lang ?? "ar"}/reports`} replace />;
  }

  return (
    <div
      className={`app-bg flex min-h-screen flex-col ${showDemoBanner ? "pt-12" : ""}`}
    >
      {showDemoBanner && <DemoBanner />}
      <Navbar />

      {/* pb للجوال: مساحة لشريط التنقّل السفلي الثابت */}
      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
