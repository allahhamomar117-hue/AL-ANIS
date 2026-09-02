import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FaExclamationTriangle, FaTimes, FaUserShield } from "react-icons/fa";
import { useStaff, useUpdateUser } from "../../lib/api/hooks";
import type { Department } from "../../lib/api/types";
import { useAuth } from "../../context/authContext";
import { departmentToSend } from "../../lib/department";
import DepartmentField from "../../shared/DepartmentField";
import { useToast } from "../../shared/toast/toastContext";

/**
 * نافذة «تعيين مدير دورة»: ترقية حسابٍ قائم إلى مدير قسم.
 *
 * لا حقول اسم ولا كلمة مرور هنا — هذه ليست نافذة إنشاء. الحساب موجود
 * أصلاً في قائمة الكادر، والمطلوب تغيير شيئين فيه فقط: الدور إلى ADMIN
 * والقسم الذي يديره. ولإنشاء مدير بحسابٍ جديد تُستعمل أزرار الإضافة
 * الأخرى ثم يُختار الدور «مدير» داخل نافذة الحساب.
 *
 * ── لماذا القسم إلزاميّ هنا ───────────────────────────────────────────
 * ADMIN مع department = NULL ليس «مديراً بلا قسم» بل هو المدير العام —
 * نطاقه المعهد كلّه (راجع الملاحظة على DEPARTMENTS في api/types.ts).
 * فلو تُرك الحقل فارغاً لأنتجت هذه النافذة مديراً عامّاً جديداً بدل مدير
 * دورة، وهو أخطر ما يمكن أن تفعله شاشةٌ عنوانها «إضافة مدير دورة».
 * لذلك يُمنع الحفظ حتى يُختار قسم.
 *
 * ومدير القسم لا تُعرض له القائمة أصلاً: departmentToSend تُعيد له
 * undefined فيملأ الخادم قسمَه، وهو القسم الوحيد الذي يملك إسناده.
 */
export default function PopupDepartmentManagerForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const { user, isSuperAdmin } = useAuth();

  const [userId, setUserId] = useState<number | "">("");
  const [department, setDepartment] = useState<Department | "">("");

  const staff = useStaff({ includeInactive: false });
  const updateUser = useUpdateUser();

  /*
   * الحساب الذاتي مستبعَد: الخادم يرفض تعديل المُنفِّذ لدوره أو تعطيله
   * (PATCH /users/:id)، فإبقاؤه في القائمة يَعِد بما يُردّ بـ 400.
   */
  const candidates = useMemo(
    () => (staff.data ?? []).filter((member) => member.id !== user?.id),
    [staff.data, user?.id]
  );

  const selected = candidates.find((member) => member.id === userId);

  /*
   * إسناد مديرٍ عامّ إلى دورة تقليصٌ لنطاقه لا توسيع: يفقد رؤية بقية
   * الأقسام. عمليةٌ مشروعة، لكنها ليست ما يقصده من فتح هذه النافذة
   * غالباً — فتُقال قبل الحفظ لا بعده.
   */
  const narrowsSuperAdmin = selected?.role === "ADMIN" && selected.department === null;

  const departmentChosen = isSuperAdmin ? department !== "" : true;
  const valid = userId !== "" && departmentChosen && !updateUser.isPending;

  const submit = async () => {
    if (!valid || !selected) return;

    const dept = departmentToSend(department, isSuperAdmin);

    try {
      await updateUser.mutateAsync({
        id: selected.id,
        role: "ADMIN",
        // مطويّ لا مُمرّراً كـ undefined: القسم قرار الخادم لمدير القسم
        ...(dept !== undefined ? { department: dept } : {}),
      });
      // useUpdateUser تُبطل مفاتيح الكادر، فتتحدّث القائمة خلف النافذة وحدها
      notify(t("staff.managerAssigned", { name: selected.name }));
      onClose();
    } catch {
      // الرسالة تظهر من كائن الخطأ أسفل النموذج
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light px-4 py-3 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-amber-700 dark:text-amber-400">
            <FaUserShield />
            {t("staff.assignManagerTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-dark-light"
          >
            <FaTimes />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("staff.assignManagerHint")}
        </p>

        {/* الحساب */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("staff.managerAccount")}
          </label>
          {staff.isPending ? (
            <p className="text-xs text-gray-400">{t("state.loading")}</p>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-gray-400">{t("staff.noCandidates")}</p>
          ) : (
            <select
              value={userId}
              onChange={(e) =>
                setUserId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className={fieldClass}
            >
              <option value="">{t("staff.pickAccount")}</option>
              {candidates.map((member) => (
                <option key={member.id} value={member.id}>
                  {/*
                    الدور والقسم الحاليان في السطر نفسه: بدونهما تتشابه
                    الأسماء ولا يُعرف ما الذي سيغيّره الحفظ.
                  */}
                  {member.name} — {t(`roles.${member.role}`)}
                  {member.department
                    ? ` · ${t(`departments.${member.department}`)}`
                    : ` · ${t("staff.allDepartments")}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* الدورة/القسم — إلزاميّ للمدير العام، ومحسوم لمدير القسم */}
        <DepartmentField
          value={department}
          onChange={setDepartment}
          label={t("staff.managedDepartment")}
          emptyLabel={t("staff.pickDepartment")}
          lockedHint={t("staff.departmentLocked")}
          className={fieldClass}
        />
        {isSuperAdmin && userId !== "" && department === "" && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {t("staff.departmentRequired")}
          </p>
        )}

        {narrowsSuperAdmin && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <FaExclamationTriangle className="mt-0.5 shrink-0" />
            {t("staff.narrowsSuperAdmin", { name: selected?.name })}
          </p>
        )}

        {updateUser.error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {updateUser.error instanceof Error
              ? updateUser.error.message
              : t("state.error")}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={updateUser.isPending}
            className="rounded-xl bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid}
            className="rounded-xl bg-amber-600 px-5 py-2 font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {updateUser.isPending ? t("state.saving") : t("staff.assignManager")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
