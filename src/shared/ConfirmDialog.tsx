import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FaExclamationTriangle } from "react-icons/fa";

/**
 * نافذة تأكيد قبل إجراء لا يُستحسن وقوعه بالخطأ.
 *
 * بديل window.confirm: هذه تتبع سمة المظهر (فاتح/داكن) واتجاه الصفحة،
 * ولا تُجمّد الصفحة، ويمكن تنسيقها — بخلاف نافذة المتصفّح.
 *
 * إمكانية الوصول: Escape يُغلق، والتركيز ينتقل إلى زر التأكيد عند الفتح
 * فيكفي Enter لإتمام العملية بلا فأرة.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger للأفعال المتلفة (أحمر)، neutral لما دونها (أخضر). */
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-400"
      : "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400";

  const iconClass =
    tone === "danger"
      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
      : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400";

  // عبر بوابة إلى body: شريط التنقّل يستخدم backdrop-blur، وأي عنصر بمرشّح
  // يصبح الحاوية المرجعية لأبنائه fixed، فتُحسب inset-0 داخله بدل الشاشة.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-gray-200 bg-white p-6
          text-center shadow-2xl dark:border-gray-600 dark:bg-dark"
      >
        <div
          className={`mx-auto flex size-14 items-center justify-center rounded-full ${iconClass}`}
        >
          <FaExclamationTriangle size={22} />
        </div>

        <h2 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h2>

        {message && (
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{message}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-gray-200 px-4 py-2.5 font-bold text-gray-800 transition
              hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400
              dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 font-bold text-white shadow transition
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmClass}`}
          >
            {confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
