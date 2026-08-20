import { useAuth } from "../../context/authContext";
import { useHalaqat } from "./hooks";

export interface CurrentHalaqa {
  /**
   * معرّف الحلقة المفروض تلقائياً.
   * - TEACHER: حلقته (تُطبَّق على كل الصفحات دون اختيار).
   * - ADMIN: `undefined` أي بلا قيد، فيختار من القائمة.
   */
  halaqaId: number | undefined;
  halaqaName: string | null;
  /** هل تُعرض واجهة اختيار الحلقة؟ للمدير والمشرف فقط. */
  showHalaqaPicker: boolean;
  /** الحلقات المتاحة للاختيار (للمدير والمشرف). */
  halaqat: { id: number; name: string }[];
  isLoading: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
}

/**
 * مصدر واحد لتحديد الحلقة الفعّالة في كل الصفحات.
 *
 * المدرّس مقيَّد بحلقته: تُفتح الصفحات عليها مباشرة ويختفي خيار الاختيار.
 * المدير والمشرف بلا قيد: يريان كل الحلقات وينتقلان بينها.
 *
 * الخادم يطبّق النطاق نفسه، فهذا لتحسين التجربة لا للحماية.
 */
export function useCurrentHalaqa(): CurrentHalaqa {
  const { isAdmin, isTeacher, halaqaId, halaqaName, halaqat, isLoading } = useAuth();
  const all = useHalaqat();

  if (isTeacher) {
    return {
      halaqaId: halaqaId ?? undefined,
      halaqaName,
      showHalaqaPicker: false,
      halaqat,
      isLoading,
      isTeacher: true,
      isAdmin: false,
    };
  }

  return {
    halaqaId: undefined,
    halaqaName: null,
    showHalaqaPicker: true,
    halaqat: all.data ?? [],
    isLoading: isLoading || all.isPending,
    isTeacher: false,
    isAdmin,
  };
}
