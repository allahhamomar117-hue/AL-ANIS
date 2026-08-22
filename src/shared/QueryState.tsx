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

/**
 * شعار نابض: حلقتان تتمدّدان من المركز مع نواة ثابتة.
 *
 * ping من Tailwind بلا إضافات: الحلقة الثانية مؤخّرة بـ 500ms فتتولّدان
 * تباعاً بدل أن تنطبقا. النواة لا تنبض حتى يبقى للعين مركز ثابت.
 */
export function PulseLoader({ className = "size-16" }: { className?: string }) {
  return (
    <div role="status" aria-label="loading" className={`relative ${className}`}>
      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30 dark:bg-emerald-400/20" />
      <span
        className="absolute inset-2 animate-ping rounded-full bg-emerald-500/30 dark:bg-emerald-400/25"
        style={{ animationDelay: "500ms" }}
      />
      <span className="absolute inset-[38%] rounded-full bg-emerald-600 dark:bg-emerald-400" />
    </div>
  );
}

/**
 * صفّ هيكل عظمي — مستطيلات رمادية بنبض خفيف بمقاس المحتوى القادم.
 *
 * تُفضَّل على الدوّارة حين يكون الشكل النهائي معروفاً: العين تستقرّ على
 * التخطيط قبل وصول البيانات فلا تقفز الصفحة عند ورودها.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-xl bg-gray-200/80 dark:bg-gray-700/60 ${className}`}
    />
  );
}

/** شبكة بطاقات هيكلية — لصفحات القوائم أثناء أول تحميل. */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-dark"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** حالة التحميل بمساحة كاملة. */
export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20">
      <PulseLoader />
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          {label ?? t("state.loading")}
        </p>
        {/* شريط يمسح من طرف إلى طرف: إشارة أن العمل جارٍ لا متوقّف */}
        <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-full w-1/3 animate-[loading-sweep_1.4s_ease-in-out_infinite] rounded-full bg-emerald-500 dark:bg-emerald-400" />
        </div>
      </div>
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
