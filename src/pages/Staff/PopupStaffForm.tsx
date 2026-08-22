import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FaTimes, FaUserPlus, FaUserTie } from "react-icons/fa";
import { useCreateUser, useHalaqat, useUpdateUser, useUserHalaqat } from "../../lib/api/hooks";
import type { Role, StaffUser } from "../../lib/api/types";
import { useToast } from "../../shared/toast/toastContext";

/**
 * نافذة إنشاء/تعديل حساب كادر.
 *
 * عند التعديل تُترك كلمة المرور فارغة للإبقاء عليها كما هي؛ الخادم لا يُعيد
 * التجزئة أبداً، فلا شيء نملأ به الحقل.
 */
export default function PopupStaffForm({
  onClose,
  role: initialRole,
  editing,
}: {
  onClose: () => void;
  /** الدور المبدئي عند الإضافة: أستاذ أو مشرف. */
  role: Role;
  editing?: StaffUser;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();

  const isEdit = Boolean(editing);
  const [name, setName] = useState(editing?.name ?? "");
  const [username, setUsername] = useState(editing?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(editing?.role ?? initialRole);
  /** null = لم يلمس المستخدم الرقاقات بعد، فالمعروض هو الإسناد الحالي. */
  const [picked, setPicked] = useState<number[] | null>(null);

  const { data: halaqat = [] } = useHalaqat();

  /**
   * نطاق الحساب الحالي كما يراه الخادم: صفوف الإسناد + الحلقات التي هو
   * أستاذها الأساسي. كلها رقاقات قابلة للإلغاء، والخادم يزامن المصدرين معاً.
   */
  const assigned = useUserHalaqat(editing?.id);

  // الرقاقات تعرض النطاق الحالي ما لم يعدّله المستخدم، فيرسل الحفظ القائمة
  // كاملة بدل قائمة فارغة تمحو ما سبق
  const assignedIds = useMemo(
    () => (assigned.data ?? []).map((h) => h.id),
    [assigned.data]
  );
  const halaqaIds = picked ?? assignedIds;

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const pending = createUser.isPending || updateUser.isPending;
  const error = createUser.error ?? updateUser.error;

  // المشرف يرى كل الحلقات بحكم دوره، فالإسناد يخصّ الأستاذ وحده
  const needsHalaqat = role === "TEACHER";

  const valid =
    name.trim().length >= 2 &&
    username.trim().length >= 3 &&
    (isEdit ? password === "" || password.length >= 4 : password.length >= 4);

  const toggleHalaqa = (id: number) => {
    setPicked((prev) => {
      const base = prev ?? assignedIds;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  const submit = async () => {
    if (!valid || pending) return;

    try {
      if (isEdit && editing) {
        await updateUser.mutateAsync({
          id: editing.id,
          name: name.trim(),
          username: username.trim(),
          role,
          ...(password ? { password } : {}),
          // الإرسال استبدال كامل، والقائمة محمّلة بالإسناد الحالي فلا يضيع منها شيء.
          // لا تُرسل قبل وصول الإسناد كي لا يُمحى بقائمة فارغة.
          ...(needsHalaqat && assigned.isSuccess ? { halaqaIds } : {}),
        });
        notify(t("staff.updated"));
      } else {
        await createUser.mutateAsync({
          name: name.trim(),
          username: username.trim(),
          password,
          role,
          halaqaIds: needsHalaqat ? halaqaIds : [],
        });
        notify(t("staff.created"));
      }
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
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-700 dark:text-emerald-400">
            {role === "TEACHER" ? <FaUserPlus /> : <FaUserTie />}
            {isEdit ? t("staff.editTitle") : t("staff.addTitle")}
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

        {/* الدور */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("staff.role")}
          </label>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-dark-light">
            {(["TEACHER", "SUPERVISOR"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={`rounded-lg py-2 text-sm font-bold transition ${
                  role === option
                    ? "bg-emerald-500 text-white shadow"
                    : "text-gray-600 dark:text-gray-300"
                }`}
              >
                {t(`roles.${option}`)}
              </button>
            ))}
          </div>
        </div>

        {/* الاسم */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("staff.name")}
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </div>

        {/* اسم المستخدم */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("staff.username")}
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            className={fieldClass}
          />
        </div>

        {/* كلمة المرور */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("staff.password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={isEdit ? t("staff.passwordKeep") : ""}
            className={fieldClass}
          />
          {password !== "" && password.length < 4 && (
            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
              {t("staff.passwordTooShort")}
            </p>
          )}
        </div>

        {/* الحلقات المخصّصة — للأستاذ فقط */}
        {needsHalaqat && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t("staff.halaqat")}
            </label>
            {halaqat.length === 0 ? (
              <p className="text-xs text-gray-400">{t("staff.noHalaqat")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {halaqat.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleHalaqa(h.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      halaqaIds.includes(h.id)
                        ? "bg-emerald-500 text-white shadow"
                        : "bg-gray-100 text-gray-700 hover:bg-emerald-100 dark:bg-dark-light dark:text-gray-200 dark:hover:bg-emerald-900/40"
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
            {isEdit && assigned.isPending && (
              <p className="mt-1 text-xs text-gray-400">{t("state.loading")}</p>
            )}
            {isEdit && (
              <p className="mt-1 text-xs text-gray-400">{t("staff.halaqatSyncHint")}</p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error instanceof Error ? error.message : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || pending}
            className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? t("state.saving") : t("staff.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
