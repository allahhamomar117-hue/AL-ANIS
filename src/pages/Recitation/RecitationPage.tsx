import StudentCard from "../../shared/StudentCard";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { useHalaqa, useHalaqaStudents } from "../../lib/api/hooks";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";

export default function RecitationPage() {
  const navigate = useNavigate();
  const { id: groupId, lang = "ar" } = useParams();
  const { t } = useTranslation();

  const halaqaId = Number(groupId);

  // نفس علّة صفحة الحضور: قائمة الحلقات تفتح حلقة المدرّس تلقائياً،
  // فالعودة إليها ترتدّ إلى هنا. المدرّس يعود إلى الرئيسية.
  const { isTeacher } = useCurrentHalaqa();
  const backTo = isTeacher ? `/${lang}` : `/${lang}/recitation-groups`;
  const { data: halaqa } = useHalaqa(halaqaId);
  const { data: students, isPending, isError, error, refetch } = useHalaqaStudents(halaqaId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark px-3 pb-6 md:px-8 text-right pt-20 md:pt-24 rtl transition-colors duration-300">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1
            className={`text-xl md:text-2xl font-black text-gray-800 dark:text-white ${
              i18n.language === "en" ? "text-lg md:text-2xl" : ""
            }`}
          >
            {t("recitationPage.title")}
          </h1>
        </div>

        <button
          onClick={() => navigate(backTo)}
          className={`flex items-center gap-1
            bg-gray-200 dark:bg-dark-light
            hover:bg-gray-300 dark:hover:bg-dark-dark
            text-gray-700 dark:text-gray-300
            px-3 py-1 md:px-4 md:py-2
            rounded-lg font-semibold
            ${i18n.language === "en" ? "text-xs md:text-sm" : "text-sm md:text-base"}
            shadow transition`}
        >
          <FaArrowLeft />
          <span>{isTeacher ? t("common.backHome") : t("recitationPage.back")}</span>
        </button>
      </div>

      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
        {t("recitationPage.halaqaName", { halaqa: halaqa?.name ?? "…" })}
        {students && students.length > 0 && (
          <span className="ms-2 font-bold text-emerald-600 dark:text-emerald-400">
            ({students.length})
          </span>
        )}
      </p>

      {/* Students Grid */}
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : students.length === 0 ? (
        <EmptyState message={t("allStudents.noStudents")} icon="🧑‍🎓" />
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <StudentCard
              key={student.id}
              student={{
                id: String(student.id),
                name: student.name,
                avatarUrl: student.avatarUrl ?? undefined,
                // آخر تسميع: التاريخ ورقم الصفحة، أو شرطة إن لم يُسجَّل بعد
                lastRecitation: student.lastRecitation
                  ? `${student.lastRecitation} · ${t("recitationRegistration.pageNumber")} ${student.lastPage}`
                  : t("common.none"),
                hasRecitation: Boolean(student.lastRecitation),
              }}
              groupId={String(halaqaId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
