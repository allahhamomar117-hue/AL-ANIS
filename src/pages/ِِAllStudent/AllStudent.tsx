import { useState } from "react";
import { MdVisibility, MdEdit, MdDelete, MdSwapHoriz, MdArchive, MdUnarchive } from "react-icons/md";
import { IoPersonAdd } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PopupEditStudent } from "./PopupEditStudent";
import { PopupDeleteStudent } from "./PopupDeleteStudent";
import { PopupAddStudent } from "./PopupAddStudent";
import { PopupTransferStudents } from "./PopupTransferStudents";
import {
  useBulkTransferStudents,
  useDeleteStudent,
  useHalaqat,
  useSetStudentStatus,
  useStudents,
} from "../../lib/api/hooks";
import type { Student, StudentStatus } from "../../lib/api/types";
import { EmptyState, ErrorState, LoadingState, Spinner } from "../../shared/QueryState";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import { useToast } from "../../shared/toast/toastContext";
import Avatar from "../../shared/Avatar";
import { useAuth } from "../../context/authContext";

type PopupKind = "edit" | "delete" | "addStudent" | "transfer";

export default function AllStudent() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { notify } = useToast();

  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [popup, setPopup] = useState<PopupKind | null>(null);

  /*
   * النقل الجماعي: التحديد يُحفظ كمجموعة معرّفات لا ككائنات طلاب، فيبقى
   * صالحاً بعد أي إعادة جلب. ما يخرج من نتيجة البحث الحالية يُصفّى عند
   * الاستعمال (selectedIds أدناه) فلا يُنقل طالب لا يراه المدير.
   */
  const [selection, setSelection] = useState<Set<number>>(new Set());

  /* ===== FILTER + SEARCH ===== */
  const [selectedHalaqa, setSelectedHalaqa] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim();

  /**
   * طور الطالب المعروض. الافتراضي «النشطون» — الدورة الجارية هي شغل
   * اليوم، والمؤرشفون أرشيفٌ يُطلب عند الحاجة.
   */
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">("active");

  const current = useCurrentHalaqa();
  /**
   * الصلاحيات: المدير وحده يضيف ويعدّل ويحذف. المدرّس يرى طلاب حلقته
   * للاطّلاع فقط — تُخفى أزرار الإضافة والتعديل والحذف. المشرف لا يصل
   * إلى هذه الصفحة أصلاً (RequireStudentManager).
   * الخادم يفرض القيد نفسه، فهذا لتوضيح الواجهة لا للحماية.
   */
  const { canManageStudents } = useAuth();
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
    // الفلترة في الخادم لا في المتصفّح: القائمة محدودة بـ200 صفّاً، فترشيح
    // ما وصل منها كان يُخفي مؤرشفين لم يبلغوا الصفحة أصلاً
    status: statusFilter,
    limit: 200,
  });

  const deleteStudent = useDeleteStudent();
  const bulkTransfer = useBulkTransferStudents();
  const setStudentStatus = useSetStudentStatus();

  const students = studentsQuery.data?.data ?? [];
  const total = studentsQuery.data?.meta.total ?? 0;
  const halaqat = halaqatQuery.data ?? [];

  /** المحدَّدون الظاهرون في القائمة الحالية وحدهم. */
  const selectedIds = students.filter((s) => selection.has(s.id)).map((s) => s.id);
  const allVisibleSelected = students.length > 0 && selectedIds.length === students.length;

  const toggleStudent = (id: number) =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) students.forEach((s) => next.delete(s.id));
      else students.forEach((s) => next.add(s.id));
      return next;
    });

  const handleClose = () => {
    setPopup(null);
    setActiveStudent(null);
    deleteStudent.reset();
    bulkTransfer.reset();
  };

  const handleBulkTransfer = async (newHalaqaId: number) => {
    if (selectedIds.length === 0) return;
    const res = await bulkTransfer.mutateAsync({ studentIds: selectedIds, newHalaqaId });
    notify(
      t("toast.studentsTransferred", {
        count: res.meta.moved,
        halaqa: halaqat.find((h) => h.id === newHalaqaId)?.name ?? "",
      })
    );
    setSelection(new Set());
    handleClose();
  };

  const handleDeleteStudent = async () => {
    if (!activeStudent) return;
    await deleteStudent.mutateAsync({ id: activeStudent.id });
    notify(t("toast.studentDeleted"));
    handleClose();
  };

  const openPopup = (kind: PopupKind, student?: Student) => {
    if (student) setActiveStudent(student);
    setPopup(kind);
  };

  /**
   * أرشفة الطالب أو إعادته. بلا نافذة تأكيد: العملية غير هادمة ويعكسها
   * الزرّ نفسه في نقرة — خلافاً للحذف. والإشعار يسمّي الطالب لأن الصفّ
   * يختفي من القائمة فور الحفظ (فلتر «النشطون») فلا يبقى أثر بصريّ يدلّ
   * على ما جرى.
   */
  const toggleArchive = async (student: Student) => {
    const next: StudentStatus = student.status === "archived" ? "active" : "archived";
    try {
      await setStudentStatus.mutateAsync({ id: student.id, status: next });
      notify(
        t(next === "archived" ? "toast.studentArchived" : "toast.studentRestored", {
          name: student.name,
        })
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : t("state.error"), "error");
    }
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
                {canManageStudents && (
                  <th className="px-4 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label={t("allStudents.selectAll")}
                      title={t("allStudents.selectAll")}
                      className="size-5 accent-emerald-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-4 font-bold">{t("allStudents.studentName")}</th>
                <th className="px-6 py-4 font-bold">{t("allStudents.points")}</th>
                <th className="px-6 py-4 font-bold text-left">{t("allStudents.actions")}</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-gray-700">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-emerald-50/60 dark:hover:bg-dark-light">
                  {canManageStudents && (
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selection.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        aria-label={`${t("allStudents.select")} ${s.name}`}
                        className="size-5 accent-emerald-500 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} url={s.avatarUrl} className="size-10" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 dark:text-white">{s.name}</span>
                          {s.status === "archived" && <ArchivedBadge />}
                        </div>
                        <div className="text-xs text-emerald-700/70 dark:text-gray-400">
                          #{s.code}
                        </div>
                      </div>
                    </div>
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
                      onToggleArchive={() => void toggleArchive(s)}
                      archiving={setStudentStatus.isPending}
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
                {canManageStudents && (
                  <input
                    type="checkbox"
                    checked={selection.has(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    aria-label={`${t("allStudents.select")} ${s.name}`}
                    className="size-5 accent-emerald-500 cursor-pointer"
                  />
                )}
                <Avatar name={s.name} url={s.avatarUrl} className="size-12" textClassName="text-lg" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-white">{s.name}</span>
                    {s.status === "archived" && <ArchivedBadge />}
                  </div>
                  <div className="text-xs text-emerald-700/70 dark:text-gray-400">
                    {t("allStudents.studentNumber")} {s.code}
                  </div>
                </div>
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {s.points}
                </div>
              </div>

              {/* خط الرأس أعلاه يفصلها وحده — بلا حدّ ثانٍ يزدحم به الكرت */}
              <div className="pt-3">
                <ActionButtons
                  student={s}
                  canManage={canManageStudents}
                  onView={() => navigate(`StudentProfile/${s.id}`)}
                  onPopup={openPopup}
                  onToggleArchive={() => void toggleArchive(s)}
                  archiving={setStudentStatus.isPending}
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
            <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white md:text-4xl">
              {t("allStudents.title")}
            </h1>
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

        {/* ===== فلتر طور الطالب — للمدير وحده (هو من يؤرشف) ===== */}
        {canManageStudents && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {(["active", "archived", "all"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setStatusFilter(option)}
                className={chipClass(statusFilter === option)}
              >
                {t(`allStudents.statusFilter.${option}`)}
              </button>
            ))}
          </div>
        )}

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

        {/* ===== BULK TRANSFER BAR — يظهر بمجرد تحديد طالب ===== */}
        {canManageStudents && selectedIds.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-dark px-4 py-3">
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {t("allStudents.selected", { count: selectedIds.length })}
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setSelection(new Set())}
                className="min-h-[44px] px-4 rounded-xl bg-white dark:bg-dark-light border dark:border-gray-600 text-gray-700 dark:text-white font-bold transition active:scale-95"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => setPopup("transfer")}
                className="flex min-h-[44px] items-center justify-center gap-2 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow transition active:scale-95"
              >
                <MdSwapHoriz className="text-xl" />
                {t("allStudents.transferSelected", { count: selectedIds.length })}
              </button>
            </div>
          </div>
        )}

        {renderBody()}
      </main>

      {/* ===== POPUPS ===== */}
      {popup === "edit" && activeStudent && canManageStudents && (
        <PopupEditStudent student={activeStudent} onClose={handleClose} />
      )}
      {popup === "delete" && activeStudent && canManageStudents && (
        <PopupDeleteStudent
          studentName={activeStudent.name}
          deleting={deleteStudent.isPending}
          error={deleteStudent.error}
          onDelete={() => void handleDeleteStudent()}
          onClose={handleClose}
        />
      )}
      {popup === "addStudent" && canManageStudents && <PopupAddStudent onClose={handleClose} />}
      {popup === "transfer" && canManageStudents && (
        <PopupTransferStudents
          count={selectedIds.length}
          halaqat={halaqat}
          transferring={bulkTransfer.isPending}
          error={bulkTransfer.error}
          onTransfer={(halaqaId) => void handleBulkTransfer(halaqaId)}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

/**
 * شارة «مؤرشف» — لازمة في فلتر «الكل» وحده، حيث يختلط الطوران في قائمة
 * واحدة فلا يميّزهما شيء. تُحذف الحاجة إليها في الفلترين الآخرين لأن
 * القائمة كلها من طورٍ واحد، لكن إبقاءها أبسط من إخفائها شرطياً.
 */
function ArchivedBadge() {
  const { t } = useTranslation();
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      {t("studentStatuses.archived")}
    </span>
  );
}

/* ===== ACTION BUTTONS ===== */
function ActionButtons({
  student,
  canManage,
  onView,
  onPopup,
  onToggleArchive,
  archiving,
  small,
}: {
  student: Student;
  /** المدير والمشرف وحدهما يعدّلان؛ المدرّس للاطّلاع فقط. */
  canManage: boolean;
  onView: () => void;
  onPopup: (kind: PopupKind, student: Student) => void;
  onToggleArchive: () => void;
  archiving: boolean;
  small?: boolean;
}) {
  const { t } = useTranslation();

  /*
   * الجوال (small): الأزرار صف واحد متساوي العرض يتوسّط البطاقة، بارتفاع
   * 44px — أدنى هدف لمس مريح — وبلا التفاف مهما ضاقت الشاشة.
   * الجدول: أيقونات مربّعة متراصة في عمود الإجراءات.
   */
  const button = small
    ? "h-11 flex-1 basis-0 min-w-0 max-w-[96px]"
    : "size-10 shrink-0";
  const row = small
    ? "flex flex-row flex-nowrap items-center justify-center gap-3"
    : "flex flex-row flex-nowrap items-center gap-2";
  const base = "rounded-xl flex items-center justify-center active:scale-95 transition";

  return (
    <div className={row}>
      <button
        onClick={onView}
        aria-label={t("allStudents.actions")}
        title={t("allStudents.actions")}
        className={`${button} ${base} bg-slate-100 dark:bg-gray-700`}
      >
        <MdVisibility className="text-xl text-gray-800 dark:text-white" />
      </button>

      {canManage && (
        <>
          <button
            onClick={() => onPopup("edit", student)}
            aria-label={t("allStudents.editStudent")}
            title={t("allStudents.editStudent")}
            className={`${button} ${base} bg-blue-100 dark:bg-blue-700`}
          >
            <MdEdit className="text-xl text-blue-800 dark:text-white" />
          </button>

          {/*
           * الأرشفة قبل الحذف في الترتيب: هي الإجراء الشائع في نهاية
           * الدورة، والحذف استثناء لخطأ إدخال. وأيقونتان مختلفتان لأنهما
           * عمليتان مختلفتان — المؤرشف يُستعاد، والمحذوف لا.
           */}
          <button
            onClick={onToggleArchive}
            disabled={archiving}
            aria-label={
              student.status === "archived"
                ? t("allStudents.restoreStudent")
                : t("allStudents.archiveStudent")
            }
            title={
              student.status === "archived"
                ? t("allStudents.restoreStudent")
                : t("allStudents.archiveStudent")
            }
            className={`${button} ${base} disabled:opacity-50 ${
              student.status === "archived"
                ? "bg-emerald-100 dark:bg-emerald-700"
                : "bg-amber-100 dark:bg-amber-700"
            }`}
          >
            {student.status === "archived" ? (
              <MdUnarchive className="text-xl text-emerald-800 dark:text-white" />
            ) : (
              <MdArchive className="text-xl text-amber-800 dark:text-white" />
            )}
          </button>

          <button
            onClick={() => onPopup("delete", student)}
            aria-label={t("allStudents.deleteStudent")}
            title={t("allStudents.deleteStudent")}
            className={`${button} ${base} bg-red-100 dark:bg-red-700`}
          >
            <MdDelete className="text-xl text-red-800 dark:text-white" />
          </button>
        </>
      )}
    </div>
  );
}
