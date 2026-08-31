import { useTranslation } from "react-i18next";
import type { Department } from "../lib/api/types";

/**
 * رقاقة القسم — لكل قسم لونه الثابت.
 *
 * اللون جزء من المعنى لا زينة: صفحة الكادر والحلقات عند المدير العام
 * تخلط الأقسام الثلاثة في قائمة واحدة، فاللون هو ما يجعل التمييز بينها
 * بلمحة بدل قراءة كل رقاقة. ولذلك ثبِّت اللون على القسم لا على الترتيب.
 *
 * الألوان مختارة بعيداً عن الأخضر: الأخضر لون الحالة الموجبة في كل
 * الواجهة (النجاح، الطالب الفعّال، الحفظ) — ولو أخذه قسمٌ لقُرئ تمييزاً
 * له لا تسميةً.
 */
const TONE: Record<Department, string> = {
  PRIMARY:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  MIDDLE_HIGH:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  INTENSIVE:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
};

export default function DepartmentBadge({
  department,
  className = "",
}: {
  department: Department | null;
  /**
   * دلالة null تختلف بحسب الموضع، فلا تُعرَض رقاقة لها هنا: الحساب بلا
   * قسم مديرٌ عام، والحلقة بلا قسم غير مسنَدة — ولا نصّ واحد يصدق عليهما.
   * تكفّل كلَّ حالةٍ صفحتُها.
   */
  className?: string;
}) {
  const { t } = useTranslation();
  if (!department) return null;

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[department]} ${className}`}
    >
      {t(`departments.${department}`)}
    </span>
  );
}
