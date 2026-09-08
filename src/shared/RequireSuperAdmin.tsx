import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { LoadingState } from "./QueryState";

/**
 * يحمي المسارات التي موردُها شأنُ المعهد كلّه: المدير العام وحده.
 *
 * أضيق من RequireManager: ذاك يفحص الدور (canManageUsers)، وهذا يفحص
 * النطاق معه — فمدير القسم دورُه ADMIN ويمرّ من الأول ويُردّ من هذا.
 *
 * وإخفاء الرابط من شريط التنقّل لا يغني عن هذا: الرابط المخفيّ يبقى
 * مسارًا يُكتب في شريط العنوان. الحارس الفعليّ requireSuperAdmin على
 * الخادم، وهذا يجنّب المستخدم صفحةَ 403 بعد أن حمّل الصفحة.
 */
export default function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { isSuperAdmin, canManageUsers, isLoading } = useAuth();
  const { lang = "ar" } = useParams();

  if (isLoading) return <LoadingState />;
  if (!canManageUsers || !isSuperAdmin) return <Navigate to={`/${lang}`} replace />;

  return <>{children}</>;
}
