import HalaqaGrid from "../../shared/HalaqaGrid";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useHalaqat } from "../../lib/api/hooks";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import { Navigate } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";

export default function RecitationGroups() {
  const navigate = useNavigate();
  const params = useParams();
  const { t } = useTranslation();

  const { data: halaqat, isPending, isError, error, refetch } = useHalaqat();
  const current = useCurrentHalaqa();

  const handleSelectHalaqa = (id: number) => {
    navigate(`/${params?.lang || "ar"}/recitation-groups/${id}`);
  };

  // المدرّس مرتبط بحلقة واحدة: نفتحها مباشرة بلا خطوة اختيار
  if (!current.isLoading && current.isTeacher && current.halaqaId) {
    return <Navigate to={`/${params?.lang || "ar"}/recitation-groups/${current.halaqaId}`} replace />;
  }


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-light px-4 sm:px-8 py-6 pt-20 md:pt-24 rtl transition-colors duration-300">
      
      {/* العنوان + زر السجل */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        
        {/* العنوان */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 text-gray-800 dark:text-white">
            {t("recitationGroups.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
            {t("recitationGroups.subtitle")}
          </p>
        </div>

        {/* زر السجل */}
        <button
          onClick={() => navigate("recitation-records")}
          className="
            inline-flex items-center justify-center 
            bg-primary text-white
            px-4 py-2 rounded-lg shadow 
            hover:bg-primary-dark transition
            text-sm sm:text-base w-full sm:w-auto cursor-pointer
          "
        >
          <span className="text-base">
            {t("recitationGroups.recordButton")}
          </span>
        </button>
      </div>

      {/* شبكة الحلقات */}
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : halaqat.length === 0 ? (
        <EmptyState message={t("halaqaGroups.empty")} icon="🕌" />
      ) : (
        <HalaqaGrid halaqat={halaqat} onSelect={(id) => handleSelectHalaqa(id)} />
      )}
    </div>
  );
}
