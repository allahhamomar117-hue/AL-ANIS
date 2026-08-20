import { createContext, use } from "react";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface ToastContextValue {
  /** يعرض إشعاراً ويخفيه تلقائياً. النوع الافتراضي نجاح. */
  notify: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * إظهار إشعارات التأكيد. يجب أن يكون داخل <ToastProvider>.
 *
 * مثال: `const { notify } = useToast(); notify("تم حفظ التسميع بنجاح");`
 */
export function useToast(): ToastContextValue {
  const context = use(ToastContext);
  if (!context) throw new Error("useToast يجب أن يُستخدم داخل ToastProvider");
  return context;
}
