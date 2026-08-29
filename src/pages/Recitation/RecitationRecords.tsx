import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PopupRecitationRegistration from "./PopupRecitationRegistration";
import { recitationsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { useHalaqat } from "../../lib/api/hooks";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import type { Recitation } from "../../lib/api/types";
import { surahName } from "../../lib/quran/surahs";
import Avatar from "../../shared/Avatar";
import { formatRelativeDay } from "../../lib/format/date";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";

export default function RecitationRecords() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [showPopup, setShowPopup] = useState(false);
  const [halaqaId, setHalaqaId] = useState<number | "">("");

  const { data: halaqat = [] } = useHalaqat();
  const current = useCurrentHalaqa();

  const params = {
    halaqaId: current.isTeacher ? current.halaqaId : halaqaId === "" ? undefined : halaqaId,
    limit: 100,
  };
  const recitations = useQuery({
    queryKey: qk.recitations.list(params),
    queryFn: () => recitationsApi.list(params),
    select: (res) => res.data,
  });

  /** الحذف يسترجع نقاط التسميع تلقائياً في الخادم. */
  const remove = useMutation({
    mutationFn: (id: number) => recitationsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.recitations.all });
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      void queryClient.invalidateQueries({ queryKey: qk.reports.all });
    },
  });

  // تجميع التلاوات حسب اليوم للحفاظ على شكل السجل اليومي
  const byDate = new Map<string, Recitation[]>();
  for (const row of recitations.data ?? []) {
    const list = byDate.get(row.recitedAt) ?? [];
    list.push(row);
    byDate.set(row.recitedAt, list);
  }

  const describe = (row: Recitation) => {
    // التسميع بالسورة يُخزَّن بصفحاته أيضاً، لكن اسم السورة أوضح للمدرّس
    const surah = surahName(row.surahNumber);
    if (surah) return t("recitationRecords.types.surah", { surah });

    // 'surah' بلا اسم سورة معروف (سجل قديم) يُوصف بصفحته
    if (row.type === "surah" || row.type === "full")
      return t("recitationRecords.types.full", { page: row.pageNumber });
    if (row.type === "half")
      return t("recitationRecords.types.half", {
        page: row.pageNumber,
        completed: row.pageCompleted
          ? t("recitationRecords.completed")
          : t("recitationRecords.notCompleted"),
        verse: row.verse,
      });
    return t("recitationRecords.types.more", { from: row.pageNumber, to: row.toPage });
  };

  const ratingLabel = (rating: Recitation["rating"]) =>
    t(`recitationRegistration.ratings.${rating === "needs" ? "average" : rating}`);

  return (
    <div className="min-h-screen bg-white dark:bg-dark p-4 pt-20 md:pt-24 transition-colors duration-300">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-primary text-center">
          {t("recitationRecords.title")}
        </h1>

        <div className="flex gap-2">
          {current.showHalaqaPicker && (
          <select
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
            className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-light px-4 py-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t("recitationRecords.selectHalaqa")}</option>
            {halaqat.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          )}

          <button
            onClick={() => setShowPopup(true)}
            className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark transition text-sm shrink-0"
          >
            {t("recitationRecords.addButton")}
          </button>
        </div>

        {remove.isError && (
          <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-400">
            {remove.error instanceof Error ? remove.error.message : t("state.error")}
          </p>
        )}

        {recitations.isPending ? (
          <LoadingState />
        ) : recitations.isError ? (
          <ErrorState error={recitations.error} onRetry={() => void recitations.refetch()} />
        ) : byDate.size === 0 ? (
          <EmptyState message={t("recitationRecords.noRecords")} icon="📖" />
        ) : (
          [...byDate.entries()].map(([date, rows]) => (
            <div
              key={date}
              className="border border-primary/20 dark:border-primary/30 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-dark-light"
            >
              {/* رأس التاريخ */}
              <div className="bg-primary/10 dark:bg-primary/20 px-4 py-3">
                <p className="font-semibold text-primary">
                  📅{" "}
                  {formatRelativeDay(date, i18n.language, {
                    today: t("common.today"),
                    yesterday: t("common.yesterday"),
                  })}
                </p>
              </div>

              {/* التلاوات */}
              <div className="divide-y dark:divide-gray-700">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        name={row.studentName}
                        url={row.studentAvatarUrl}
                        className="mt-0.5 size-9"
                      />
                      <div className="flex flex-col gap-1">
                      <p className="font-medium text-gray-800 dark:text-white">
                        {row.studentName}
                        {row.halaqa && ` (${row.halaqa})`}
                      </p>

                      <span className="text-sm text-primary">{describe(row)}</span>

                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t("recitationRecords.rating")}: {ratingLabel(row.rating)}
                      </span>
                      </div>
                    </div>

                    <button
                      onClick={() => remove.mutate(row.id)}
                      disabled={remove.isPending}
                      className="text-sm px-3 py-1 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50 shrink-0"
                    >
                      {t("recitationRecords.delete")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showPopup && <PopupRecitationRegistration onClose={() => setShowPopup(false)} />}
    </div>
  );
}
