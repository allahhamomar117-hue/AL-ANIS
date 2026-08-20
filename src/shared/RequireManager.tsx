import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { LoadingState } from "./QueryState";

/**
 * يحمي مسارات إدارة الحسابات: المدير (ADMIN) وحده.
 * المشرف يمرّ من RequireAdmin لصفحات البيانات، لكنه يُمنع هنا —
 * الخادم يرفض بـ403 على أي حال، وهذا يجنّب المستخدم صفحة أخطاء.
 */
export default function RequireManager({ children }: { children: ReactNode }) {
  const { canManageUsers, isLoading } = useAuth();
  const { lang = "ar" } = useParams();

  if (isLoading) return <LoadingState />;
  if (!canManageUsers) return <Navigate to={`/${lang}`} replace />;

  return <>{children}</>;
}
