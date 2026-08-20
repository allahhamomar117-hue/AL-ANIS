import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/authContext";
import { getToken } from "../lib/api";
import { ErrorState, LoadingState } from "./QueryState";

/**
 * حارس المسارات: لا يُعرض المحتوى إلا لجلسة صالحة.
 *
 * - لا يوجد رمز، أو الرمز منتهٍ/غير صالح (401/403) → تحويل حتمي إلى /login.
 * - الخادم متوقف أو خطأ شبكة → رسالة وإعادة محاولة، بلا طرد المستخدم.
 *
 * يُحفظ المسار المقصود في state.from ليعود إليه بعد الدخول.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, isLoading, error, refresh } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-light">
        <LoadingState label={t("state.connecting")} />
      </div>
    );
  }

  if (error || !user) {
    const status = (error as { status?: number } | null)?.status;
    const unauthorized = status === 401 || status === 403;

    // بلا رمز أصلاً، أو الرمز مرفوض: إلى الدخول.
    // أما تعذّر الوصول للخادم مع وجود رمز فلا يُخرج المستخدم من جلسته.
    if (unauthorized || !getToken()) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    // خطأ اتصال وليس مصادقة: لا نطرد المستخدم من الجلسة
    return (
      <div className="min-h-screen bg-white dark:bg-dark-light">
        <ErrorState error={error} onRetry={refresh} />
        <p className="pb-10 text-center text-xs text-gray-400">{t("state.serverHint")}</p>
      </div>
    );
  }

  return <>{children}</>;
}
