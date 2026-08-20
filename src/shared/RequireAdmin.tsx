import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { LoadingState } from "./QueryState";

/**
 * يحمي المسارات ذات الصلاحية الموسّعة: المدير والمشرف معاً (isAdmin).
 * لإدارة الحسابات استعمل RequireManager — المدير وحده.
 * الخادم يرفض بـ403 على أي حال؛ هذا يمنع عرض صفحة أخطاء للمدرّس.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  const { lang = "ar" } = useParams();

  if (isLoading) return <LoadingState />;
  if (!isAdmin) return <Navigate to={`/${lang}`} replace />;

  return <>{children}</>;
}
