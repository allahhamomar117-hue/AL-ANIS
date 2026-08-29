import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recitationsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { useHalaqaStudents, useHalaqat } from "../../lib/api/hooks";
import { todayLocal } from "../../lib/format/date";

type RecitationType = "full" | "more";
type Rating = "excellent" | "good" | "needs";

interface Props {
  onClose: () => void;
}

export default function PopupRecitationRegistration({ onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: halaqat = [] } = useHalaqat();
  const [halaqaId, setHalaqaId] = useState<number | "">("");
  const { data: students = [] } = useHalaqaStudents(halaqaId === "" ? undefined : halaqaId);

  const [studentId, setStudentId] = useState<number | "">("");
  const [recitationType, setRecitationType] = useState<RecitationType>("full");
  const [rating, setRating] = useState<Rating>("good");
  const [pageNumber, setPageNumber] = useState<number | "">("");
  const [toPage, setToPage] = useState<number | "">("");
  const [recitedAt, setRecitedAt] = useState(todayLocal());

  const create = useMutation({
    mutationFn: () =>
      recitationsApi.create({
        studentId: Number(studentId),
        halaqaId: halaqaId === "" ? undefined : halaqaId,
        type: recitationType,
        pageNumber: Number(pageNumber),
        toPage: recitationType === "more" ? Number(toPage) : null,
        verse: null,
        pageCompleted: true,
        rating,
        recitedAt,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.recitations.all });
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
      onClose();
    },
  });

  // نفس شروط الخادم
  const valid =
    studentId !== "" &&
    typeof pageNumber === "number" &&
    pageNumber > 0 &&
    (recitationType !== "more" || (typeof toPage === "number" && toPage >= pageNumber));

  const fieldClass =
    "w-full rounded-full border dark:border-gray-600 bg-white dark:bg-dark-light text-gray-800 dark:text-white px-4 py-2 focus:ring-2 focus:ring-primary outline-none";

  const numeric = (value: string) => (value === "" ? "" : Number(value));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-dark rounded-2xl w-full max-w-md sm:p-6 p-4 max-h-[90vh] overflow-y-auto transition-colors duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4 text-center text-primary">
          {t("popupRecitation.title")}
        </h2>

        {/* الحلقة */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            {t("popupRecitation.halaqaLabel")}
          </label>
          <select
            value={halaqaId}
            onChange={(e) => {
              setHalaqaId(e.target.value === "" ? "" : Number(e.target.value));
              setStudentId("");
            }}
            className={fieldClass}
          >
            <option value="">{t("popupAttendance.selectHalaqa")}</option>
            {halaqat.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        {/* الطالب */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            {t("popupRecitation.studentLabel")}
          </label>
          <select
            value={studentId}
            disabled={halaqaId === ""}
            onChange={(e) => setStudentId(e.target.value === "" ? "" : Number(e.target.value))}
            className={`${fieldClass} disabled:opacity-60`}
          >
            <option value="">
              {halaqaId === ""
                ? t("popupRecitation.selectHalaqaFirst")
                : t("popupRecitation.selectStudent")}
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* التاريخ */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            {t("popupRecitation.date")}
          </label>
          <input
            type="date"
            value={recitedAt}
            onChange={(e) => setRecitedAt(e.target.value)}
            className={fieldClass}
          />
        </div>

        {/* نوع التسميع */}
        <div className="mb-4">
          <p className="font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t("popupRecitation.recitationType")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button active={recitationType === "full"} onClick={() => setRecitationType("full")}>
              {t("popupRecitation.types.full")}
            </Button>
            <Button active={recitationType === "more"} onClick={() => setRecitationType("more")}>
              {t("popupRecitation.types.more")}
            </Button>
          </div>
        </div>

        {/* رقم الصفحة */}
        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            {recitationType === "more"
              ? t("popupRecitation.fromPage")
              : t("popupRecitation.pageNumber")}
          </label>
          <input
            type="number"
            min={1}
            max={604}
            value={pageNumber}
            onChange={(e) => setPageNumber(numeric(e.target.value))}
            placeholder={t("popupRecitation.pagePlaceholder")}
            className={fieldClass}
          />
        </div>


        {/* أكثر من صفحة */}
        {recitationType === "more" && (
          <div className="mb-4">
            <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
              {t("popupRecitation.toPage")}
            </label>
            <input
              type="number"
              min={1}
              max={604}
              value={toPage}
              onChange={(e) => setToPage(numeric(e.target.value))}
              placeholder={t("popupRecitation.toPagePlaceholder")}
              className={fieldClass}
            />
          </div>
        )}

        {/* التقييم */}
        <div className="mb-4">
          <p className="font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t("popupRecitation.rating")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button active={rating === "excellent"} onClick={() => setRating("excellent")}>
              {t("recitationRegistration.ratings.excellent")}
            </Button>
            <Button active={rating === "good"} onClick={() => setRating("good")}>
              {t("recitationRegistration.ratings.good")}
            </Button>
            <Button active={rating === "needs"} onClick={() => setRating("needs")}>
              {t("recitationRegistration.ratings.average")}
            </Button>
          </div>
        </div>

        {create.isError && (
          <p className="mb-3 text-sm font-bold text-red-600 dark:text-red-400">
            {create.error instanceof Error ? create.error.message : t("state.error")}
          </p>
        )}

        {/* الأزرار */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            disabled={create.isPending}
            className="px-4 py-2 rounded-full border dark:border-gray-600
            text-gray-700 dark:text-gray-300
            hover:bg-gray-50 dark:hover:bg-dark-light transition disabled:opacity-50"
          >
            {t("popupRecitation.cancel")}
          </button>

          <button
            onClick={() => create.mutate()}
            disabled={!valid || create.isPending}
            className="px-4 py-2 rounded-full bg-primary text-white
            hover:bg-primary-dark transition disabled:opacity-50"
          >
            {create.isPending ? t("popupRecitation.saving") : t("popupRecitation.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- زر موحد ---------- */
function Button({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm transition flex items-center justify-center gap-1
      ${
        active
          ? "bg-primary/10 border-primary text-primary shadow-inner"
          : "bg-gray-50 dark:bg-dark-light border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-dark hover:shadow-md"
      }`}
    >
      {children}
    </button>
  );
}
