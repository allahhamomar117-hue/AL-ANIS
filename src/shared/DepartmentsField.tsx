import { useTranslation } from "react-i18next";
import { useAuth } from "../context/authContext";
import { DEPARTMENTS, type Department } from "../lib/api/types";
import DepartmentBadge from "./DepartmentBadge";

/**
 * حقل اختيار أقسام الحساب — اختيار متعدّد (الترقية 017).
 *
 * نظير DepartmentField المفرد الذي تستعمله الحلقة: الحلقة تتبع قسماً
 * واحداً فيبقى لها ذاك، والحساب قد يخدم أكثر من قسم فله هذا.
 *
 * ── لماذا مربّعات اختيار لا قائمة متعدّدة؟ ───────────────────────────
 * الخيارات ثلاثة لا تزيد. و<select multiple> يُخفي غيرَ المختار خلف
 * تمرير، ويتطلّب Ctrl+نقر لاختيار الثاني — وهي حركةٌ لا يعرفها كثير من
 * المستخدمين ولا وجود لها على الجوال أصلاً. المربّعات تُظهر الخيارات
 * كلَّها وحالةَ كلٍّ منها دفعةً واحدة، والنقرة الواحدة تكفي.
 *
 * ── القاعدة، مطابقةً لما يفرضه الخادم ───────────────────────────────
 * المدير العام  : يختار ما شاء، والفراغ يعني «المعهد كلّه» — أي أنه
 *                 ينشئ مديراً عاماً آخر، ولذلك يُقال له ذلك صراحةً بدل
 *                 أن يظنّ الحقل ناقصاً.
 * مدير القسم    : لا يختار — تُعرض أقسامه رقاقاتٍ ثابتة وتُسنَد تلقائياً
 *                 (departmentsToSend تُعيد له undefined فيملؤها الخادم).
 *
 * وأي انحراف بين هذا الملف و resolveDepartments على الخادم يظهر
 * للمستخدم رسالةَ 403 بعد أن ملأ النموذج — وهو أسوأ من منعٍ واضح قبله.
 */
export default function DepartmentsField({
  value,
  onChange,
  label,
  /** نصّ يُعرض للمدير العام حين لا يختار شيئاً. */
  emptyHint,
  /** تلميح يُعرض لمدير القسم تحت الرقاقات. */
  lockedHint,
}: {
  value: Department[];
  onChange: (value: Department[]) => void;
  label: string;
  emptyHint: string;
  lockedHint: string;
}) {
  const { t } = useTranslation();
  // الأقسام من السياق لا من user.departments خاماً: المدرّس له أقسام
  // أيضاً، لكن نطاقه حلقاته لا أقسامه
  const { departments: scope, isSuperAdmin } = useAuth();

  const labelClass = "mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300";

  // مدير القسم: الأقسام محسومة، فلا خيارات تُعرض
  if (!isSuperAdmin) {
    return (
      <div>
        <label className={labelClass}>{label}</label>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 dark:border-gray-600">
          {scope.map((dept) => (
            <DepartmentBadge key={dept} department={dept} />
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">{lockedHint}</p>
      </div>
    );
  }

  /** الترتيب من DEPARTMENTS لا من ترتيب النقر، فلا تقفز الرقاقات. */
  const toggle = (dept: Department) =>
    onChange(
      value.includes(dept)
        ? value.filter((d) => d !== dept)
        : DEPARTMENTS.filter((d) => d === dept || value.includes(d))
    );

  return (
    <div>
      <label className={labelClass}>{label}</label>

      <div className="flex flex-col gap-1 rounded-xl border border-gray-300 p-2 dark:border-gray-600">
        {DEPARTMENTS.map((dept) => {
          const checked = value.includes(dept);
          return (
            <label
              key={dept}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition
                ${checked ? "bg-emerald-50 dark:bg-emerald-900/30" : "hover:bg-gray-50 dark:hover:bg-dark-light/30"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(dept)}
                className="size-4 shrink-0 accent-emerald-600"
              />
              <span className="text-sm font-semibold text-gray-800 dark:text-white">
                {t(`departments.${dept}`)}
              </span>
            </label>
          );
        })}
      </div>

      {/*
        الفراغ معنىً لا نقص: حسابٌ بلا أقسام نطاقه المعهد كلّه. وسكوتُ
        الحقل عنه يجعل المدير العام يظنّ أنه نسي الاختيار، فيُقال صراحةً.
      */}
      {value.length === 0 && (
        <p className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-400">{emptyHint}</p>
      )}
    </div>
  );
}
