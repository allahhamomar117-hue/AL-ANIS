import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FaEye, FaEyeSlash, FaKey, FaTimes } from "react-icons/fa";
import { useSetUserPassword } from "../../lib/api/hooks";
import type { StaffUser } from "../../lib/api/types";
import { useToast } from "../../shared/toast/toastContext";

const MIN_LENGTH = 8;

/**
 * نافذة تغيير كلمة مرور حساب كادر — للمدير وحده.
 *
 * الحقل يبدأ فارغاً دائماً: الخادم لا يعيد التجزئة، فلا شيء نملأ به.
 * التأكيد حقل ثانٍ لأن الخطأ المطبعي هنا يقفل الحساب على صاحبه.
 */
export default function PopupChangePassword({
  member,
  onClose,
}: {
  member: StaffUser;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { notify } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);

  const setUserPassword = useSetUserPassword();

  const tooShort = password !== "" && password.length < MIN_LENGTH;
  const mismatch = confirm !== "" && confirm !== password;
  const valid = password.length >= MIN_LENGTH && confirm === password;

  const submit = async () => {
    if (!valid || setUserPassword.isPending) return;
    try {
      await setUserPassword.mutateAsync({ id: member.id, password });
      notify(t("staff.passwordChanged", { name: member.name }));
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
        className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-600 dark:bg-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-700 dark:text-emerald-400">
            <FaKey />
            {t("staff.changePasswordTitle")}
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
          {t("staff.changePasswordFor", { name: member.name })}
        </p>

        {/* كلمة المرور الجديدة */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("staff.newPassword")}
          </label>
          <div className="relative">
            <input
              type={visible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={t(visible ? "staff.hidePassword" : "staff.showPassword")}
              className="absolute inset-y-0 end-3 flex items-center text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
            >
              {visible ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          {tooShort && (
            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
              {t("staff.passwordMinEight")}
            </p>
          )}
        </div>

        {/* التأكيد */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("staff.confirmPassword")}
          </label>
          <input
            type={visible ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={fieldClass}
          />
          {mismatch && (
            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
              {t("staff.passwordMismatch")}
            </p>
          )}
        </div>

        {setUserPassword.error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {setUserPassword.error instanceof Error
              ? setUserPassword.error.message
              : t("state.error")}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={setUserPassword.isPending}
            className="rounded-xl bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || setUserPassword.isPending}
            className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {setUserPassword.isPending ? t("state.saving") : t("staff.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
