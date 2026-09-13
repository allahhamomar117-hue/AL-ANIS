import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HalaqaGrid from "../../shared/HalaqaGrid";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";
import { useHalaqat } from "../../lib/api/hooks";
import { useIntensiveHalaqat } from "../../lib/api/useIntensiveHalaqat";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";

/**
 * اختيار الحلقة لتسجيل مقرَّر اليوم — نظير AttendanceGroups.
 *
 * الفرق الوحيد عنها أن الشبكة مقصورة على حلقات المكثفة: الميزة خاصّة
 * بها، وعرضُ حلقةٍ تردّ الخادمُ عنها بـ403 عند الضغط بابٌ مغلق يُعرض
 * مفتوحاً.
 */
export default function AssignmentGroups() {
  const navigate = useNavigate();
  const params = useParams();
  const { t } = useTranslation();
  const lang = params?.lang || "ar";

  const { isError, error, refetch } = useHalaqat();
  const { halaqat, isLoading } = useIntensiveHalaqat();
  const current = useCurrentHalaqa();

  /*
   * المدرّس بحلقة مكثفة واحدة تُفتح مباشرة بلا خطوة اختيار — كما في
   * الحضور. والشرط على حلقاته المكثفة لا على حلقته الافتراضية: مدرّسٌ
   * حلقتُه الافتراضية ابتدائية وله مكثفة أخرى كان يُحوَّل إلى صفحة
   * تردّها الخادم بـ403.
   */
  if (!isLoading && current.isTeacher && halaqat.length === 1) {
    return <Navigate to={`/${lang}/assignments-groups/${halaqat[0].id}`} replace />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-dark-light px-4 sm:px-8 py-6 pt-20 md:pt-24 rtl transition-colors duration-300">
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-bold text-gray-800 dark:text-white sm:text-3xl">
          {t("assignmentGroups.title")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-300 sm:text-base">
          {t("assignmentGroups.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : halaqat.length === 0 ? (
        <EmptyState message={t("assignmentGroups.empty")} icon="📋" />
      ) : (
        <HalaqaGrid
          halaqat={halaqat}
          onSelect={(id) => navigate(`/${lang}/assignments-groups/${id}`)}
        />
      )}
    </div>
  );
}
