import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaEdit, FaUserCheck, FaUserPlus, FaUserSlash, FaUserTie } from "react-icons/fa";
import { useDeactivateUser, useStaff, useUpdateUser } from "../../lib/api/hooks";
import type { Role, StaffUser } from "../../lib/api/types";
import { ErrorState, LoadingState } from "../../shared/QueryState";
import { useToast } from "../../shared/toast/toastContext";
import { useAuth } from "../../context/authContext";
import PopupStaffForm from "./PopupStaffForm";

/**
 * صفحة إدارة الكادر — للمدير وحده (المسار محمي بـ RequireManager،
 * وكل مسارات /api/users محصورة بدور ADMIN على الخادم).
 */
export default function StaffPage() {
  const { t } = useTranslation();
  const { lang = "ar" } = useParams();
  const { notify } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState<{ role: Role; editing?: StaffUser } | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const staff = useStaff({ includeInactive: showInactive });
  const deactivate = useDeactivateUser();
  const updateUser = useUpdateUser();

  const list = staff.data ?? [];

  const remove = async (member: StaffUser) => {
    if (!window.confirm(t("staff.confirmDeactivate", { name: member.name }))) return;
    try {
      await deactivate.mutateAsync(member.id);
      notify(t("staff.deactivated"));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("state.error"), "error");
    }
  };

  /** إعادة التفعيل تمرّ من نفس مسار التعديل (is_active) لا من مسار التعطيل. */
  const activate = async (member: StaffUser) => {
    try {
      await updateUser.mutateAsync({ id: member.id, is_active: true });
      notify(t("staff.activated"));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("state.error"), "error");
    }
  };

  const roleBadge = (role: Role) =>
    role === "ADMIN"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      : role === "SUPERVISOR"
        ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";

  return (
    <div
      className="min-h-screen bg-emerald-50/40 pt-20 dark:bg-dark-light md:pt-24"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 md:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-1 text-2xl font-bold text-gray-800 dark:text-white md:text-4xl">
              {t("staff.title")}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
              {t("staff.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setForm({ role: "TEACHER" })}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white shadow transition hover:bg-emerald-700"
            >
              <FaUserPlus />
              {t("staff.addTeacher")}
            </button>
            <button
              onClick={() => setForm({ role: "SUPERVISOR" })}
              className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 font-bold text-white shadow transition hover:bg-sky-700"
            >
              <FaUserTie />
              {t("staff.addSupervisor")}
            </button>
          </div>
        </header>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-4 accent-emerald-600"
          />
          {t("staff.showInactive")}
        </label>

        {staff.isPending ? (
          <LoadingState />
        ) : staff.isError ? (
          <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 py-16 text-center text-gray-400 dark:border-gray-600">
            {t("staff.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((member) => (
              <li
                key={member.id}
                className={`flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-dark sm:flex-row sm:items-center sm:justify-between ${
                  member.isActive ? "" : "opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-gray-800 dark:text-white">
                      {member.name}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${roleBadge(member.role)}`}
                    >
                      {t(`roles.${member.role}`)}
                    </span>
                    {!member.isActive && (
                      <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {t("staff.inactive")}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400" dir="ltr">
                    {member.username ?? "—"}
                  </p>

                  {member.role === "TEACHER" && (
                    <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                      {member.halaqatNames ?? t("staff.noAssignedHalaqat")}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setForm({ role: member.role, editing: member })}
                    className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-200 dark:bg-dark-light dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <FaEdit />
                    {t("staff.edit")}
                  </button>

                  {/* المدير لا يعطّل نفسه؛ الخادم يرفض ذلك أيضاً */}
                  {member.isActive === 1
                    ? member.id !== user?.id && (
                        <button
                          onClick={() => void remove(member)}
                          disabled={deactivate.isPending}
                          className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400"
                        >
                          <FaUserSlash />
                          {t("staff.deactivate")}
                        </button>
                      )
                    : (
                        <button
                          onClick={() => void activate(member)}
                          disabled={updateUser.isPending}
                          className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-900/20 dark:text-emerald-400"
                        >
                          <FaUserCheck />
                          {t("staff.activate")}
                        </button>
                      )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form && (
        <PopupStaffForm
          role={form.role}
          editing={form.editing}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
