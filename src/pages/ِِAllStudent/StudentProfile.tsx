import { useParams } from "react-router-dom";
import { useState } from "react";
import { MdPerson, MdSchool, MdStars, MdEventAvailable } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useStudent, useStudentPoints } from "../../lib/api/hooks";
import Avatar from "../../shared/Avatar";
import { attendanceApi, recitationsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import type { PointTransaction, Recitation } from "../../lib/api/types";
import { surahName } from "../../lib/quran/surahs";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";
import { formatDate, formatShortDate } from "../../lib/format/date";

type Tab = "info" | "recitation" | "attendance" | "points";

export default function StudentProfile() {
  const { id } = useParams();
  const studentId = Number(id);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const { t } = useTranslation();

  const { data, isPending, isError, error, refetch } = useStudent(studentId);

  if (isPending) {
    return (
      <div className="min-h-screen bg-emerald-50/30 dark:bg-dark-light/30 pt-20 md:pt-24">
        <LoadingState />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-emerald-50/30 dark:bg-dark-light/30 pt-20 md:pt-24">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const student = data.data;
  const stats = data.stats;

  return (
    <div className="min-h-screen bg-emerald-50/30 dark:bg-dark-light/30 pt-20 md:pt-24" dir="rtl">
      <main className="max-w-[1000px] mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* ===== Header ===== */}
        <div className="bg-white dark:bg-dark-light rounded-2xl p-4 md:p-6 flex items-center gap-4 shadow-sm">
          <Avatar
            name={student.name}
            url={student.avatarUrl}
            className="size-14 md:size-20"
            textClassName="text-lg md:text-2xl"
          />
          <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center">
            <h1 className="text-lg md:text-2xl font-bold text-emerald-800 dark:text-emerald-400">
              {student.name}
            </h1>
            <p className="text-sm md:text-base text-emerald-600 dark:text-emerald-300 mt-1 md:mt-0">
              {student.halaqa || t("common.none")}
            </p>
            <p className="text-gray-400 dark:text-gray-300 text-[11px] md:text-sm mt-1 md:mt-0">
              {t("studentProfile.studentId")} #{student.code}
            </p>
          </div>
        </div>

        {/* ===== Stats ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<MdStars />} label={t("studentProfile.points")} value={student.points} />
          {/* الحضور: الأيام أوضح من نسبة مجرّدة — كم يوماً حضر من كم يوم دوام */}
          <StatCard
            icon={<MdEventAvailable />}
            label={t("studentProfile.attendance")}
            value={t("studentProfile.attendedDays", {
              days: t("common.days", { count: stats.attendance.attended }),
              rate: stats.attendance.rate,
            })}
            note={t("studentProfile.outOfDays", {
              days: t("common.days", { count: stats.attendance.sessions }),
            })}
          />
          <StatCard
            icon={<MdSchool />}
            label={t("studentProfile.halaqa")}
            value={student.halaqa || t("common.none")}
          />
          <StatCard
            icon={<MdPerson />}
            label={t("studentProfile.birthDate")}
            value={student.birthDate || t("common.none")}
          />
        </div>

        {/* ===== Tabs ===== */}
        <div className="bg-white dark:bg-dark-light rounded-2xl p-4 shadow-md">
          <div className="flex gap-2 border-b dark:border-gray-600 mb-4 overflow-x-auto scrollbar-hide">
            <TabButton
              label={t("studentProfile.tabs.info")}
              active={activeTab === "info"}
              onClick={() => setActiveTab("info")}
            />
            <TabButton
              label={t("studentProfile.tabs.recitation")}
              active={activeTab === "recitation"}
              onClick={() => setActiveTab("recitation")}
            />
            <TabButton
              label={t("studentProfile.tabs.attendance")}
              active={activeTab === "attendance"}
              onClick={() => setActiveTab("attendance")}
            />
            <TabButton
              label={t("studentProfile.tabs.points")}
              active={activeTab === "points"}
              onClick={() => setActiveTab("points")}
            />
          </div>

          <div className="space-y-3">
            {activeTab === "info" && <InfoTab student={student} />}
            {activeTab === "recitation" && <RecitationTab studentId={studentId} />}
            {activeTab === "attendance" && (
              <AttendanceTab studentId={studentId} halaqaId={student.halaqaId} />
            )}
            {activeTab === "points" && <PointsTab studentId={studentId} />}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ================= Components ================= */
function StatCard({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** سطر فرعي صغير أسفل القيمة. */
  note?: string;
}) {
  return (
    <div className="bg-white dark:bg-dark-light rounded-xl p-2 md:p-3 flex gap-2 md:gap-3 items-center text-sm md:text-base shadow hover:shadow-lg transition-shadow">
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-100 dark:bg-emerald-700 flex items-center justify-center text-emerald-700 dark:text-white text-base md:text-xl">
        {icon}
      </div>
      <div className="truncate">
        <div className="text-xs md:text-sm text-emerald-600 dark:text-emerald-300 truncate">
          {label}
        </div>
        <div className="font-medium truncate dark:text-white">{value}</div>
        {note && (
          <div className="truncate text-[10px] md:text-xs text-gray-400 dark:text-gray-500">
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-2 text-sm md:text-base font-bold whitespace-nowrap transition-all
        ${
          active
            ? "border-b-4 border-emerald-500 text-emerald-700 dark:text-emerald-400"
            : "text-gray-500 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
        }`}
    >
      {label}
    </button>
  );
}

function InfoTab({ student }: { student: import("../../lib/api/types").Student }) {
  const { t } = useTranslation();
  const dash = t("common.none");

  return (
    <div className="flex flex-col gap-2">
      <InfoRow label={t("studentProfile.fields.name")} value={student.name} />
      <InfoRow label={t("studentProfile.fields.studentId")} value={student.code} />
      <InfoRow label={t("studentProfile.fields.birthDate")} value={student.birthDate || dash} />
      <InfoRow label={t("studentProfile.fields.studentPhone")} value={student.studentPhone || dash} />
      <InfoRow label={t("studentProfile.fields.guardianPhone")} value={student.parentPhone || dash} />
    </div>
  );
}

/** سجل التلاوة الحقيقي للطالب. */
function RecitationTab({ studentId }: { studentId: number }) {
  const { t, i18n } = useTranslation();
  const params = { studentId, limit: 30 };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk.recitations.list(params),
    queryFn: () => recitationsApi.list(params),
  });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const rows = data.data;
  if (rows.length === 0) return <EmptyState message={t("studentProfile.noRecitations")} icon="📖" />;

  const typeOf = (row: Recitation) => {
    const surah = surahName(row.surahNumber);
    return surah
      ? t("recitationRegistration.types.surah", { surah })
      : t(`recitationRegistration.types.${row.type}`);
  };

  const rangeOf = (row: Recitation) =>
    row.type === "more" && row.toPage
      ? `${row.pageNumber} → ${row.toPage}`
      : String(row.pageNumber);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.id}
          className="bg-white dark:bg-dark-light p-3 rounded-xl shadow hover:shadow-md flex flex-col gap-1 text-sm md:text-base"
        >
          <Row
            label={t("studentProfile.recitation.date")}
            value={formatDate(row.recitedAt, i18n.language)}
          />
          <Row
            label={t("studentProfile.recitation.type")}
            value={typeOf(row)}
          />
          <Row label={t("studentProfile.recitation.from")} value={rangeOf(row)} />
          <div className="flex justify-between">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {t("studentProfile.recitation.grade")}:
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-300">
              {t(`recitationRegistration.ratings.${row.rating === "needs" ? "average" : row.rating}`)}
            </span>
          </div>
          {row.notes && (
            <p className="border-t dark:border-gray-700 pt-1 text-xs text-gray-500 dark:text-gray-400">
              {row.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/** سجل حضور الطالب مستخرج من جلسات حلقته. */
function AttendanceTab({
  studentId,
  halaqaId,
}: {
  studentId: number;
  halaqaId: number | null;
}) {
  const { t, i18n } = useTranslation();
  const params = { halaqaId: halaqaId ?? undefined, limit: 60 };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk.attendance.sessions(params),
    queryFn: () => attendanceApi.sessions(params),
    enabled: halaqaId !== null,
  });

  if (halaqaId === null) return <EmptyState message={t("studentProfile.noAttendance")} icon="🗓️" />;
  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const rows = data.data
    .map((session) => ({
      date: session.date,
      entry: session.students.find((s) => s.studentId === studentId),
    }))
    .filter((row): row is { date: string; entry: NonNullable<typeof row.entry> } => Boolean(row.entry));

  if (rows.length === 0) return <EmptyState message={t("studentProfile.noAttendance")} icon="🗓️" />;

  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const present = row.entry.status === "present" || row.entry.status === "late";
        return (
          <li
            key={row.date}
            className={`flex justify-between p-2 rounded-lg text-sm md:text-base font-medium ${
              present ? "bg-emerald-50 dark:bg-emerald-700/10" : "bg-red-50 dark:bg-red-700/10"
            }`}
          >
            <span className="dark:text-white">{formatDate(row.date, i18n.language)}</span>
            <span
              className={`font-bold ${
                present
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {present ? t("common.present") : t("common.absent")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** سجل حركات النقاط. */
function PointsTab({ studentId }: { studentId: number }) {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError, error, refetch } = useStudentPoints(studentId);

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const rows = data.data;
  if (rows.length === 0) return <EmptyState message={t("studentProfile.noPoints")} icon="⭐" />;

  const reasonOf = (row: PointTransaction) => row.reason || t("common.none");

  return (
    <div className="overflow-x-auto rounded-lg">
      <table className="min-w-[300px] md:min-w-[500px] w-full text-right border border-emerald-100 dark:border-gray-600 rounded-lg text-sm md:text-base">
        <thead className="bg-emerald-50 dark:bg-dark-light/30">
          <tr>
            <th className="p-2 md:p-3 text-emerald-700 dark:text-emerald-400">
              {t("studentProfile.pointsTable.date")}
            </th>
            <th className="p-2 md:p-3 text-emerald-700 dark:text-emerald-400">
              {t("studentProfile.pointsTable.points")}
            </th>
            <th className="p-2 md:p-3 text-emerald-700 dark:text-emerald-400">
              {t("studentProfile.pointsTable.reason")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-t dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-dark-light/20 transition"
            >
              <td className="p-2 md:p-3 dark:text-white">
                {formatShortDate(row.createdAt, i18n.language)}
              </td>
              <td
                className={`p-2 md:p-3 font-medium ${
                  row.delta > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {row.delta > 0 ? `+${row.delta}` : row.delta}
              </td>
              <td className="p-2 md:p-3 dark:text-white">{reasonOf(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-semibold text-emerald-700 dark:text-emerald-400">{label}:</span>
      <span className="dark:text-white">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-600 py-1">
      <span className="text-emerald-700 dark:text-emerald-400 text-sm md:text-base">{label}</span>
      <span className="font-medium text-sm md:text-base truncate dark:text-white">{value}</span>
    </div>
  );
}
