import { useHalaqat } from "./hooks";
import type { Halaqa } from "./types";

/**
 * حلقات المكثفة التي يصل إليها المستخدم — مصدر واحد لظهور ميزة المقرَّرات.
 *
 * ── لماذا من قائمة الحلقات لا من قسم المستخدم؟ ──────────────────────
 * قسمُ الحساب (users.department) يصف الإداريين وحدهم، والمدرّس لا يعنيه:
 * نطاقه حلقاته المسندة، وقد تكون من قسمين معاً (حالة واقعية لا شذوذ).
 * فالسؤال الصحيح ليس "هل المستخدم من قسم المكثفة؟" بل "هل بين حلقاته
 * حلقةُ مكثفة؟" — وجوابه في الحلقات نفسها.
 *
 * وقائمة الحلقات مقسومة على الخادم سلفاً (applyScope): المدرّس يرى
 * حلقاته، ومدير القسم قسمه، والمدير العام الجميع — فالفلترة هنا على
 * القسم وحده تكفي، بلا تكرار منطق النطاق في الواجهة.
 *
 * ⚠ إخفاء التبويب ترتيبُ شاشةٍ لا صلاحية: الحصر الفعلي في
 *   assertIntensiveHalaqa على الخادم، وهذا يمنع عرض بابٍ مغلق لا أكثر.
 */
export function useIntensiveHalaqat(): {
  halaqat: Halaqa[];
  /** هل يملك المستخدم حلقة مكثفة واحدة على الأقل؟ */
  hasAny: boolean;
  isLoading: boolean;
} {
  const { data, isPending } = useHalaqat();
  const halaqat = (data ?? []).filter((h) => h.department === "INTENSIVE");

  return { halaqat, hasAny: halaqat.length > 0, isLoading: isPending };
}
