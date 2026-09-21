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
  /*
    * القسم من السياق لا من user.departments خاماً: المدرّس له أقسام أيضاً
    * لكن نطاقه حلقاته لا أقسامه.
    *
    * والحلقة تتبع قسماً واحداً بينما الحساب صار يخدم عدّة (الترقية 017)،
    * فالرقاقة تُعرض حين لا لبس — أي حين يخدم المُنشئ قسماً واحداً. وحين
    * يخدم أكثر لا يصحّ افتراض أيّها، والخادم نفسه يردّ 400 يطلب الاختيار
    * (راجع POST /api/halaqat)، فتُعرض له القائمة ليختار.
    */
  const { departments, isSuperAdmin } = useAuth();
  const scope = departments.length === 1 ? departments[0] : null;
  const mustChoose = !isSuperAdmin && departments.length > 1;

  const labelClass =
    "mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300";

  // مدير القسم بقسم واحد: القسم محسوم، فلا قائمة تُعرض
  if (!isSuperAdmin && !mustChoose) {
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
        {/*
          «بلا قسم» للمدير العام وحده: هي قيمة تخرج عن نطاق مدير القسم
          (الخادم يردّها بـ403)، ومن يخدم أقساماً يختار من بينها لا منها.
        */}
        {isSuperAdmin && <option value="">{emptyLabel}</option>}
        {(isSuperAdmin ? DEPARTMENTS : departments).map((option) => (
          <option key={option} value={option}>
            {t(`departments.${option}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
