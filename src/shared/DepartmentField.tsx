import { useTranslation } from "react-i18next";
import { useAuth } from "../context/authContext";
import { DEPARTMENTS, type Department } from "../lib/api/types";
import DepartmentBadge from "./DepartmentBadge";

/**
 * حقل اختيار القسم — مشترك بين «إدارة الكادر» و«إدارة الحلقات».
 *
 * ملفٌّ واحد لا نسختان في نموذجين: قاعدة الصلاحية هنا تطابق ما يفرضه
 * الخادم (resolveDepartment في routes/users.ts و halaqat.ts)، وأي انحراف
 * بينهما يظهر للمستخدم رسالةَ 403 بعد أن ملأ النموذج — وهو أسوأ من منعٍ
 * واضح قبله. فإذا تغيّرت القاعدة على الخادم، فهذا الملف وحده ما يُحاذى.
 *
 * ── القاعدة ──────────────────────────────────────────────────────────
 * المدير العام  : يختار أي قسم، أو يتركه فارغاً.
 * مدير القسم    : لا يختار شيئاً — يُعرض قسمه رقاقةً ثابتة، ويُسنَد تلقائياً.
 *
 * ولماذا رقاقة معروضة لا حقل مُعطَّل ولا حقل مخفيّ؟ الحقل المعطَّل يوحي
 * بخيارٍ محجوب فيُبحث عن سبب المنع، والمخفيّ يترك مدير القسم يظنّ الحساب
 * بلا قسم فيتساءل أين ذهب. الرقاقة تقول الحقيقة كاملة: القسم معروف
 * ومحسوم، وليس ثمّة ما يُختار.
 *
 * القيمة المُرسَلة تحسبها departmentToSend في lib/department.ts — فُصلت
 * عن هذا الملف لأن قاعدة react-refresh توجب أن يصدّر ملفُ المكوّن
 * مكوّناتٍ فقط.
 */
export default function DepartmentField({
  value,
  onChange,
  label,
  /** نصّ خيار «بلا قسم» — يختلف بين الحساب (مدير عام) والحلقة (غير مسنَدة). */
  emptyLabel,
  /** تلميح يُعرض لمدير القسم تحت الرقاقة. */
  lockedHint,
  className,
}: {
  value: Department | "";
  onChange: (value: Department | "") => void;
  label: string;
  emptyLabel: string;
  lockedHint: string;
  className: string;
}) {
  const { t } = useTranslation();
  // القسم من السياق لا من user.department خاماً: المدرّس له عمود قسم
  // أيضاً، لكن نطاقه حلقاته لا قسمه
  const { department: scope, isSuperAdmin } = useAuth();

  const labelClass =
    "mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300";

  // مدير القسم: القسم محسوم، فلا قائمة تُعرض
  if (!isSuperAdmin) {
    return (
      <div>
        <label className={labelClass}>{label}</label>
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 dark:border-gray-600">
          {scope ? (
            <DepartmentBadge department={scope} />
          ) : (
            <span className="text-sm text-gray-400">{emptyLabel}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">{lockedHint}</p>
      </div>
    );
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : (e.target.value as Department))
        }
        className={className}
      >
        <option value="">{emptyLabel}</option>
        {DEPARTMENTS.map((option) => (
          <option key={option} value={option}>
            {t(`departments.${option}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
