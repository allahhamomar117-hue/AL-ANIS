import { useParams } from "react-router-dom";
import { useState } from "react";
import { MdPerson, MdSchool, MdStars, MdEventAvailable } from "react-icons/md";
import { useTranslation } from "react-i18next";

type Tab = "info" | "recitation" | "attendance" | "points";

export default function StudentProfile() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const { t } = useTranslation();

  const student = {
    id,
    name: "أحمد محمد علي",
    halaqa: "حلقة الفجر",
    birthDate: "2012/05/18",
    studentPhone: "0591234567",
    guardianPhone: "0599876543",
    points: 1250,
    totalAttendance: 82,
  };

  return (
   <div className="min-h-screen bg-emerald-50/30 dark:bg-dark-light/30 mt-14" dir="rtl">
  <main className="max-w-[1000px] mx-auto px-4 md:px-6 py-6 space-y-5">

    {/* ===== Header ===== */}
    <div className="bg-white dark:bg-dark-light rounded-2xl p-4 md:p-6 flex items-center gap-4 shadow-sm">
      <div className="size-14 md:size-20 rounded-full bg-emerald-100 dark:bg-emerald-700 flex items-center justify-center text-lg md:text-2xl font-bold text-emerald-700 dark:text-white">
        أ م
      </div>
      <div className="flex-1 flex flex-col md:flex-row md:justify-between md:items-center">
        <h1 className="text-lg md:text-2xl font-bold text-emerald-800 dark:text-emerald-400">
          {student.name}
        </h1>
        <p className="text-sm md:text-base text-emerald-600 dark:text-emerald-300 mt-1 md:mt-0">
          {student.halaqa}
        </p>
        <p className="text-gray-400 dark:text-gray-300 text-[11px] md:text-sm mt-1 md:mt-0">
          {t("studentProfile.studentId")} #{student.id}
        </p>
      </div>
    </div>

    {/* ===== Stats ===== */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard icon={<MdStars />} label={t("studentProfile.points")} value={student.points} />
      <StatCard icon={<MdEventAvailable />} label={t("studentProfile.attendance")} value={`${student.totalAttendance}%`} />
      <StatCard icon={<MdSchool />} label={t("studentProfile.halaqa")} value={student.halaqa} />
      <StatCard icon={<MdPerson />} label={t("studentProfile.birthDate")} value={student.birthDate} />
    </div>

    {/* ===== Tabs ===== */}
    <div className="bg-white dark:bg-dark-light rounded-2xl p-4 shadow-md">
      <div className="flex gap-2 border-b dark:border-gray-600 mb-4 overflow-x-auto scrollbar-hide">
        <TabButton label={t("studentProfile.tabs.info")} active={activeTab === "info"} onClick={() => setActiveTab("info")} />
        <TabButton label={t("studentProfile.tabs.recitation")} active={activeTab === "recitation"} onClick={() => setActiveTab("recitation")} />
        <TabButton label={t("studentProfile.tabs.attendance")} active={activeTab === "attendance"} onClick={() => setActiveTab("attendance")} />
        <TabButton label={t("studentProfile.tabs.points")} active={activeTab === "points"} onClick={() => setActiveTab("points")} />
      </div>

      <div className="space-y-3">
        {activeTab === "info" && <InfoTab student={student} t={t} />}
        {activeTab === "recitation" && <RecitationTab t={t} />}
        {activeTab === "attendance" && <AttendanceTab t={t} />}
        {activeTab === "points" && <PointsTab t={t} />}
      </div>
    </div>
  </main>
</div>
  );
}

/* ================= Components ================= */
function StatCard({ icon, label, value }: any) {
  return (
    <div className="bg-white dark:bg-dark-light rounded-xl p-2 md:p-3 flex gap-2 md:gap-3 items-center text-sm md:text-base shadow hover:shadow-lg transition-shadow">
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-100 dark:bg-emerald-700 flex items-center justify-center text-emerald-700 dark:text-white text-base md:text-xl">
        {icon}
      </div>
      <div className="truncate">
        <div className="text-xs md:text-sm text-emerald-600 dark:text-emerald-300 truncate">{label}</div>
        <div className="font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-2 text-sm md:text-base font-bold whitespace-nowrap transition-all
        ${active
          ? "border-b-4 border-emerald-500 text-emerald-700 dark:text-emerald-400"
          : "text-gray-500 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"}`
      }
    >
      {label}
    </button>
  );
}

function InfoTab({ student, t }: any) {
  return (
    <div className="flex flex-col gap-2">
      <InfoRow label={t("studentProfile.fields.name")} value={student.name} />
      <InfoRow label={t("studentProfile.fields.studentId")} value={student.id} />
      <InfoRow label={t("studentProfile.fields.birthDate")} value={student.birthDate} />
      <InfoRow label={t("studentProfile.fields.studentPhone")} value={student.studentPhone} />
      <InfoRow label={t("studentProfile.fields.guardianPhone")} value={student.guardianPhone} />
    </div>
  );
}

function RecitationTab({ t }: any) {
  const data = [
    { date: "2024/11/12", type: t("studentProfile.recitation.full"), from: "صفحة 12", to: "صفحة 13", grade: t("studentProfile.recitation.gradeExcellent") },
  ];

  return (
    <div className="flex flex-col gap-2">
      {data.map((row, idx) => (
        <div key={idx} className="bg-white dark:bg-dark-light p-3 rounded-xl shadow hover:shadow-md flex flex-col gap-1 text-sm md:text-base">
          <div className="flex justify-between"><span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("studentProfile.recitation.date")}:</span><span>{row.date}</span></div>
          <div className="flex justify-between"><span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("studentProfile.recitation.type")}:</span><span>{row.type}</span></div>
          <div className="flex justify-between"><span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("studentProfile.recitation.from")}:</span><span>{row.from}</span></div>
          <div className="flex justify-between"><span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("studentProfile.recitation.to")}:</span><span>{row.to}</span></div>
          <div className="flex justify-between"><span className="font-semibold text-emerald-700 dark:text-emerald-400">{t("studentProfile.recitation.grade")}:</span><span className="text-emerald-600 dark:text-emerald-300 font-bold">{row.grade}</span></div>
        </div>
      ))}
    </div>
  );
}

function AttendanceTab({ t }: any) {
  const data = [
    { date: "2024/11/10", status: t("common.present"), color: "emerald" },
    { date: "2024/11/09", status: t("common.absent"), color: "red" },
  ];

  return (
    <ul className="space-y-1">
      {data.map((row, idx) => (
        <li key={idx} className={`flex justify-between p-2 rounded-lg text-sm md:text-base font-medium bg-${row.color}-50 dark:bg-${row.color}-700/10`}>
          <span className="dark:text-white">{row.date}</span>
          <span className={`font-bold text-${row.color}-700 dark:text-${row.color}-400`}>{row.status}</span>
        </li>
      ))}
    </ul>
  );
}

function PointsTab({ t }: any) {
  const pointsData = [
    { date: "2024/11/12", points: "+50", reason: t("studentProfile.pointsReason.recitationExcellent") },
    { date: "2024/11/10", points: "+30", reason: t("studentProfile.pointsReason.goodParticipation") },
  ];

  return (
    <div className="overflow-x-auto rounded-lg">
      <table className="min-w-[300px] md:min-w-[500px] w-full text-right border border-emerald-100 dark:border-gray-600 rounded-lg text-sm md:text-base">
        <thead className="bg-emerald-50 dark:bg-dark-light/30">
          <tr>
            <th className="p-2 md:p-3 text-emerald-700 dark:text-emerald-400">{t("studentProfile.pointsTable.date")}</th>
            <th className="p-2 md:p-3 text-emerald-700 dark:text-emerald-400">{t("studentProfile.pointsTable.points")}</th>
            <th className="p-2 md:p-3 text-emerald-700 dark:text-emerald-400">{t("studentProfile.pointsTable.reason")}</th>
          </tr>
        </thead>
        <tbody>
          {pointsData.map((row, idx) => (
            <tr key={idx} className="border-t hover:bg-emerald-50 dark:hover:bg-dark-light/20 transition">
              <td className="p-2 md:p-3 dark:text-white">{row.date}</td>
              <td className={`p-2 md:p-3 font-medium ${row.points.startsWith("+") ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{row.points}</td>
              <td className="p-2 md:p-3 dark:text-white">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InfoRow({ label, value }: any) {
  return (
    <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-600 py-1">
      <span className="text-emerald-700 dark:text-emerald-400 text-sm md:text-base">{label}</span>
      <span className="font-medium text-sm md:text-base truncate dark:text-white">{value}</span>
    </div>
  );
}
