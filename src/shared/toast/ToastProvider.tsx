import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes } from "react-icons/fa";
import { ToastContext, type Toast, type ToastKind, type ToastContextValue } from "./toastContext";

const DURATION = 3000;

const STYLES: Record<ToastKind, { box: string; icon: ReactNode }> = {
  success: {
    box: "bg-emerald-500 text-white",
    icon: <FaCheckCircle className="shrink-0 text-lg" />,
  },
  error: {
    box: "bg-red-600 text-white",
    icon: <FaExclamationCircle className="shrink-0 text-lg" />,
  },
  info: {
    box: "bg-gray-800 text-white dark:bg-gray-700",
    icon: <FaInfoCircle className="shrink-0 text-lg" />,
  },
};

/**
 * إشعارات التأكيد: شريط يظهر أعلى الشاشة ويختفي وحده.
 *
 * موضعه أعلى المنتصف بـ z أعلى من شريط التنقّل الثابت (z-50) ليظهر فوقه،
 * ومحصور بعرض الشاشة ليبقى مقروءاً على الجوال.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  // نحتفظ بالمؤقتات لإلغائها عند تفكيك المكوّن فلا تُحدَّث حالة بعد الإزالة
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = nextId.current++;
      // ثلاثة كحدّ أقصى: ما فوقها يغطّي الشاشة على الجوال
      setToasts((current) => [...current.slice(-2), { id, message, kind }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext value={value}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-2.5
              rounded-xl px-4 py-3 font-bold shadow-lg
              animate-in fade-in slide-in-from-top-4 duration-300
              ${STYLES[toast.kind].box}`}
          >
            {STYLES[toast.kind].icon}
            <span className="flex-1 text-sm leading-snug">{toast.message}</span>
            <FaTimes className="shrink-0 text-xs opacity-70" />
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
