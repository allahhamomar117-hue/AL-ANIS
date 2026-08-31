import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaEdit, FaUserPlus, FaUserTie } from "react-icons/fa";
import { useStaff } from "../../lib/api/hooks";
import type { Role, StaffUser } from "../../lib/api/types";
import { useAuth } from "../../context/authContext";
import DepartmentBadge from "../../shared/DepartmentBadge";
import { ErrorState, LoadingState } from "../../shared/QueryState";
import PopupStaffForm from "./PopupStaffForm";

/**
 * صفحة إدارة الكادر — للمدير وحده (المسار محمي بـ RequireManager،
 * وكل مسارات /api/users محصورة بدور ADMIN على الخادم).
 *
 * لا عمود لحالة الحساب هنا: الحسابات مفعّلة افتراضياً، وتعطيلها
 * وتفعيلها من داخل نافذة «تعديل» مع بقية بيانات الحساب.
 */
export default function StaffPage() {
  const { t } = useTranslation();
  const { lang = "ar" } = useParams();
  const { isSuperAdmin } = useAuth();

  const [form, setForm] = useState<{ role: Role; editing?: StaffUser } | null>(null);

  const staff = useStaff({ includeInactive: true });

  const list = staff.data ?? [];

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
                className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-dark sm:flex-row sm:items-center sm:justify-between"
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
                    {/*
                      رقاقة القسم، ونصٌّ صريح بدلها حين لا قسم — والغياب
                      هنا ليس نقصاً في البيانات بل معنى: حسابٌ بلا قسم
                      نطاقُه المعهد كلّه. تركه فارغاً يقرأ كحقل لم يُملأ.

                      كلاهما يُعرض للمدير العام وحده: قائمةُ مديرِ القسم
                      كلّها قسمُه، فالرقاقة على كل صفّ ضجيج لا تمييز.
                    */}
                    {isSuperAdmin &&
                      (member.department ? (
                        <DepartmentBadge department={member.department} />
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {t("staff.allDepartments")}
                        </span>
                      ))}
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
                  {/* نافذة واحدة: البيانات والحلقات وكلمة المرور */}
                  <button
                    onClick={() => setForm({ role: member.role, editing: member })}
                    className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-200 dark:bg-dark-light dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <FaEdit />
                    {t("staff.edit")}
                  </button>
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
