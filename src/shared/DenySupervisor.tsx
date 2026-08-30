import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { LoadingState } from "./QueryState";

/**
 * يحجب عن المشرف الشاشات الخارجة عن دوره التشغيلي اليومي:
 * شاشات الطلاب (كل الطلاب وملفّ الطالب) ولوحة الصدارة والإحصاءات العامة.
 *
 * دور المشرف محصور بالتسميع والحضور والنقاط وتقارير الحلقات اليومية،
 * فيُعاد توجيهه إلى صفحة التسميع — واجهة عمله الأساسية — لا إلى الصفحة
 * الرئيسية.
 *
 * المدير يدخل بكامل الصلاحيات، والمدرّس يدخل ضمن نطاق حلقاته وحدها
 * (الخادم يقصر النطاق ويرفض أي تجاوز بـ403).
 */
export default function DenySupervisor({ children }: { children: ReactNode }) {
  const { isSupervisor, isLoading } = useAuth();
  const { lang = "ar" } = useParams();

  if (isLoading) return <LoadingState />;
  if (isSupervisor) return <Navigate to={`/${lang}/recitation-groups`} replace />;

  return <>{children}</>;
}
