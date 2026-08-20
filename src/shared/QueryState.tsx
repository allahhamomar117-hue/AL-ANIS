import { useTranslation } from "react-i18next";

/** دوّارة تحميل. */
export function Spinner({ className = "size-8" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="loading"
      className={`${className} animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500 dark:border-gray-700 dark:border-t-emerald-400`}
    />
  );
}

/** حالة التحميل بمساحة كاملة. */
export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-300">
      <Spinner />
      <span className="text-sm">{label ?? t("state.loading")}</span>
    </div>
  );
}

/** حالة الخطأ مع زر إعادة المحاولة. */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : t("state.error");

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="text-4xl">⚠️</span>
      <p className="font-bold text-red-700 dark:text-red-400">{t("state.error")}</p>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-xl bg-emerald-500 px-5 py-2 font-bold text-white transition hover:bg-emerald-600"
        >
          {t("state.retry")}
        </button>
      )}
    </div>
  );
}

/** حالة عدم وجود بيانات. */
export function EmptyState({ message, icon = "📋" }: { message?: string; icon?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-gray-500 dark:text-gray-300">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm">{message ?? t("state.empty")}</p>
    </div>
  );
}
