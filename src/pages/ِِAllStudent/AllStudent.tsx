import { useState } from "react";
import { MdVisibility, MdEdit } from "react-icons/md";
import { IoPersonAdd } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PopupEditStudent } from "./PopupEditStudent";
import { PopupAddStudent } from "./PopupAddStudent";
import { useHalaqat, useStudents } from "../../lib/api/hooks";
import type { Student } from "../../lib/api/types";
import { EmptyState, ErrorState, LoadingState, Spinner } from "../../shared/QueryState";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import Avatar from "../../shared/Avatar";

type PopupKind = "edit" | "addStudent";

export default function AllStudent() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [popup, setPopup] = useState<PopupKind | null>(null);

  /* ===== FILTER + SEARCH ===== */
  const [selectedHalaqa, setSelectedHalaqa] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();

  const current = useCurrentHalaqa();
  /**
   * الصلاحيات: المدير والمشرف يضيفان ويعدّلان ويحذفان ويريان كل الحلقات.
   * المدرّس يرى طلاب حلقته للاطّلاع فقط — تُخفى أزرار الإضافة والتعديل والحذف.
   * الخادم يفرض القيد نفسه، فهذا لتوضيح الواجهة لا للحماية.
   */
  const canManageStudents = current.isAdmin;
  const halaqatQuery = useHalaqat();
  /*
   * المدرّس: بلا مرشّح حلقة إطلاقاً.
   *
   * تمرير حلقته الافتراضية وحدها كان يُخفي طلاب حلقاته الأخرى — الأستاذ
   * المسند إلى حلقتين كان يرى نصف طلابه فقط. الخادم يقصر /students على
   * نطاقه أصلاً (applyScope)، فترك المرشّح فارغاً يعطيه طلاب حلقاته كلها
   * ولا شيء سواها.
   *
   * المدير والمشرف يختاران من الشريط.
   */
  const effectiveHalaqaId = current.isTeacher
    ? undefined
    : selectedHalaqa === "all"
      ? undefined
      : selectedHalaqa;

  const studentsQuery = useStudents({
    halaqaId: effectiveHalaqaId,
    search: trimmedSearch || undefined,
    limit: 200,
  });

  const students = studentsQuery.data?.data ?? [];
  const total = studentsQuery.data?.meta.total ?? 0;
  const halaqat = halaqatQuery.data ?? [];

  const handleClose = () => {
    setPopup(null);
    setActiveStudent(null);
  };

  const openPopup = (kind: PopupKind, student?: Student) => {
    if (student) setActiveStudent(student);
    setPopup(kind);
  };

  const chipClass = (active: boolean) =>
    `whitespace-nowrap min-h-[40px] px-4 py-2 rounded-full text-sm font-bold transition active:scale-95 ${
      active
        ? "bg-emerald-500 text-white"
        : "bg-white dark:bg-dark border dark:border-gray-600 text-emerald-700 dark:text-white hover:bg-emerald-50 dark:hover:bg-dark-light"
    }`;

  const renderBody = () => {
    if (studentsQuery.isPending) return <LoadingState />;
    if (studentsQuery.isError) {
      return <ErrorState error={studentsQuery.error} onRetry={() => void studentsQuery.refetch()} />;
    }
    if (students.length === 0) {
      return <EmptyState message={t("allStudents.noStudents")} icon="🧑‍🎓" />;
    }

    return (
      <>
        {/* ===== DESKTOP TABLE ===== */}
        <div className="hidden md:block bg-white dark:bg-dark rounded-2xl border dark:border-gray-600 overflow-hidden">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-emerald-50 dark:bg-dark-light text-emerald-700 dark:text-white text-sm border-b dark:border-gray-600">
                <th className="px-6 py-4 font-bold">{t("allStudents.studentName")}</th>
                <th className="px-6 py-4 font-bold">{t("allStudents.halaqa")}</th>
                <th className="px-6 py-4 font-bold">{t("allStudents.points")}</th>
                <th className="px-6 py-4 font-bold text-left">{t("allStudents.actions")}</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-gray-700">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-emerald-50/60 dark:hover:bg-dark-light">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} url={s.avatarUrl} className="size-10" />
                      <div>
                        <div className="font-bold text-gray-800 dark:text-white">{s.name}</div>
                        <div className="text-xs text-emerald-700/70 dark:text-gray-400">
                          #{s.code}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-md text-xs bg-emerald-100 dark:bg-gray-700 font-bold text-emerald-700 dark:text-white">
                      {s.halaqa || t("common.none")}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-700 dark:text-emerald-400">
                    {s.points}
                  </td>
                  <td className="px-6 py-4">
                    <ActionButtons
                      student={s}
                      canManage={canManageStudents}
                      onView={() => navigate(`StudentProfile/${s.id}`)}
                      onPopup={openPopup}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== MOBILE CARDS ===== */}
        <div className="md:hidden space-y-5">
          {students.map((s) => (
            <div
              key={s.id}
              className="bg-white dark:bg-dark rounded-2xl border dark:border-gray-600 shadow-sm p-4"
            >
              <div className="flex items-center gap-3 pb-3 border-b dark:border-gray-700">
                <Avatar name={s.name} url={s.avatarUrl} className="size-12" textClassName="text-lg" />
                <div className="flex-1">
                  <div className="font-bold text-gray-800 dark:text-white">{s.name}</div>
                  <div className="text-xs text-emerald-700/70 dark:text-gray-400">
                    {t("allStudents.studentNumber")} {s.code}
                  </div>
                </div>
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {s.points}
                </div>
              </div>

              <div className="pt-3">
                <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-gray-700 text-xs font-bold text-emerald-700 dark:text-white">
                  {s.halaqa || t("common.none")}
                </span>
              </div>

              <div className="pt-4">
                <ActionButtons
                  student={s}
                  canManage={canManageStudents}
                  onView={() => navigate(`StudentProfile/${s.id}`)}
                  onPopup={openPopup}
                  small
                />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div
      className="bg-emerald-50/40 dark:bg-dark-light min-h-screen pt-20 md:pt-24"
      dir={i18n.language === "ar" ? "rtl" : "ltr"}
    >
      <main className="max-w-[1200px] mx-auto px-4 md:px-10 pb-10 space-y-6 md:space-y-8">
        {/* ===== HEADER ===== */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-800 dark:text-white">
                {t("allStudents.title")}
              </h1>
              {/* المدرّس يطّلع فقط — نوضّح ذلك بدل ترك الأزرار المفقودة بلا تفسير */}
              {!canManageStudents && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {t("allStudents.readOnlyBadge")}
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">
              {canManageStudents
                ? t("allStudents.subtitle")
                : current.halaqaName ?? t("allStudents.readOnlySubtitle")}
              {!studentsQuery.isPending && (
                <span className="ms-2 font-bold text-emerald-700 dark:text-emerald-400">
                  ({t("allStudents.total")}: {total})
                </span>
              )}
            </p>
          </div>

          {canManageStudents && (
            <button
              onClick={() => openPopup("addStudent")}
              className="flex w-full md:w-auto min-h-[48px] items-center justify-center gap-2 bg-emerald-400
                hover:bg-emerald-500 active:scale-[0.98] text-white px-5 py-3 rounded-xl font-bold shadow-lg transition"
            >
              {t("allStudents.addStudentButton")}
              <IoPersonAdd />
            </button>
          )}
        </div>

        {/* ===== SEARCH ===== */}
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("allStudents.searchPlaceholder")}
            className="w-full min-h-[48px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark px-4 py-3 text-base text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          {studentsQuery.isFetching && !studentsQuery.isPending && (
            <div className="absolute inset-y-0 end-4 flex items-center">
              <Spinner className="size-5" />
            </div>
          )}
        </div>

        {/* ===== FILTER (SCROLLABLE) — للمشرف فقط ===== */}
        {current.showHalaqaPicker && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <button onClick={() => setSelectedHalaqa("all")} className={chipClass(selectedHalaqa === "all")}>
            {t("allStudents.allStudents")}
          </button>

          {halaqat.map((h) => (
            <button
              key={h.id}
              onClick={() => setSelectedHalaqa(h.id)}
              className={chipClass(selectedHalaqa === h.id)}
            >
              {h.name}
            </button>
          ))}
        </div>
        )}

        {renderBody()}
      </main>

      {/* ===== POPUPS ===== */}
      {popup === "edit" && activeStudent && canManageStudents && (
        <PopupEditStudent student={activeStudent} onClose={handleClose} />
      )}
      {popup === "addStudent" && canManageStudents && <PopupAddStudent onClose={handleClose} />}
    </div>
  );
}

/* ===== ACTION BUTTONS ===== */
function ActionButtons({
  student,
  canManage,
  onView,
  onPopup,
  small,
}: {
  student: Student;
  /** المدير والمشرف وحدهما يعدّلان؛ المدرّس للاطّلاع فقط. */
  canManage: boolean;
  onView: () => void;
  onPopup: (kind: PopupKind, student: Student) => void;
  small?: boolean;
}) {
  const { t } = useTranslation();
  // 44px حدّ أدنى لكل هدف لمس على الجوال
  const iconSize = small ? "size-11" : "size-10";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onView}
        aria-label={t("allStudents.actions")}
        className={`${iconSize} rounded-xl bg-slate-100 dark:bg-gray-700 flex items-center justify-center active:scale-95 transition`}
      >
        <MdVisibility className="text-lg text-gray-800 dark:text-white" />
      </button>

      {canManage && (
        <button
          onClick={() => onPopup("edit", student)}
          aria-label={t("allStudents.editStudent")}
          className={`${iconSize} rounded-xl bg-blue-100 dark:bg-blue-700 flex items-center justify-center active:scale-95 transition`}
        >
          <MdEdit className="text-lg text-blue-800 dark:text-white" />
        </button>
      )}
    </div>
  );
}
