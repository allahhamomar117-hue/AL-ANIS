import { useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IconType } from "react-icons";
import {
  FaBookOpen,
  FaCalendarCheck,
  FaCertificate,
  FaChartLine,
  FaUsers,
} from "react-icons/fa";
import { useAuth } from "../../context/authContext";
import { useStatistics } from "../../lib/api/hooks";
import { DEPARTMENTS } from "../../lib/api/types";
import type { Department, StatisticsDashboard as Stats } from "../../lib/api/types";
import { formatMonth } from "../../lib/format/date";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";

/**
 * لوحة الإحصاءات الشاملة — للمدير وحده (المسار محميّ بـ RequireManager،
 * و/api/statistics محصور بدور ADMIN على الخادم).
 *
 * الأرقام الكلّية بطاقاتٌ لا مخطّطات: رقم واحد لا يحتاج محورين ليُقرأ،
 * ومخطّطٌ بعمود واحد يخفي الرقم بدل أن يُظهره.
 */
export default function StatisticsDashboard() {
  const { t } = useTranslation();
  const { lang = "ar" } = useParams();

  /*
   * فلتر القسم للمدير العام وحده: مدير القسم نطاقه مقيَّد على الخادم أصلاً،
   * فتبويبٌ يعرض عليه أقساماً لا يراها وعدٌ كاذب — والخادم يردّ بأرقام قسمه
   * مهما اختار. `null` = كل الأقسام.
   */
  const { isSuperAdmin } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const active = isSuperAdmin ? department : null;

  const stats = useStatistics(active);

  return (
    <div
      className="min-h-screen bg-emerald-50/40 pt-20 dark:bg-dark-light md:pt-24"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 md:px-8">
        <header>
          <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-white md:text-4xl">
            <FaChartLine className="text-emerald-600 dark:text-emerald-400" />
            {t("statistics.title")}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
            {t("statistics.subtitle")}
          </p>
        </header>

        {isSuperAdmin && (
          <DepartmentTabs value={department} onChange={setDepartment} />
        )}

        {stats.isPending ? (
          <LoadingState />
        ) : stats.isError ? (
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
        ) : (
          <StatisticsContent data={stats.data!} />
        )}
      </div>
    </div>
  );
}

/**
 * تبويبات فلترة القسم — تبويبات لا قائمة منسدلة: الخيارات أربعة ثابتة،
 * والقائمة تُخفي الاختيار الحالي خلف نقرة بلا داعٍ.
 */
function DepartmentTabs({
  value,
  onChange,
}: {
  value: Department | null;
  onChange: (value: Department | null) => void;
}) {
  const { t } = useTranslation();
  const options: { key: Department | null; label: string }[] = [
    { key: null, label: t("statistics.filter.all") },
    ...DEPARTMENTS.map((dept) => ({
      key: dept as Department | null,
      label: t(`departments.${dept}`),
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label={t("statistics.filter.label")}
      className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm dark:bg-dark"
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key ?? "all"}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              selected
                ? "bg-emerald-600 text-white shadow"
                : "text-gray-600 hover:bg-emerald-50 dark:text-gray-300 dark:hover:bg-dark-light"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StatisticsContent({ data }: { data: Stats }) {
  const { t } = useTranslation();
  const { totals } = data;

  return (
    <>
      {/* ===== بطاقات الأرقام الكلّية ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FaBookOpen}
          label={t("statistics.cards.pages")}
          value={formatNumber(totals.recitationPages)}
          hint={t("statistics.cards.pagesHint", { count: totals.recitationCount })}
        />
        <StatCard
          icon={FaCalendarCheck}
          label={t("statistics.cards.days")}
          value={formatNumber(totals.attendanceDays)}
          hint={t("statistics.cards.daysHint", { count: totals.attendanceSessions })}
        />
        <StatCard
          icon={FaCertificate}
          label={t("statistics.cards.awqaf")}
          value={formatNumber(totals.awqafPassed)}
          hint={t("statistics.cards.awqafHint", { count: totals.awqafTotal })}
        />
        <StatCard
          icon={FaUsers}
          label={t("statistics.cards.students")}
          value={formatNumber(totals.students)}
          hint={t("statistics.cards.studentsHint", { count: totals.halaqat })}
        />
      </div>

      <RecitationChart points={data.monthlyRecitation} />
      <AwqafChart stats={data.awqafStats} />
    </>
  );
}

/* ==================== البطاقات ==================== */

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: IconType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-dark">
      <div className="mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <Icon className="text-lg" />
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold text-gray-800 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}

/* ==================== المخطّطات ==================== */

/**
 * إطار موحّد لكل مخطّط: عنوان، وشرح، ثم مساحة الرسم.
 *
 * الرسم نفسه بالاتجاه LTR دائماً مهما كانت لغة الواجهة. محور الزمن يقرأ
 * من الأقدم إلى الأحدث، وقلبه في RTL يجعل الخطّ الصاعد يبدو هابطاً —
 * والمحاور الرقمية تُعرض يساراً-يميناً في كل اللغات. العنوان والشرح
 * يبقيان باتجاه الصفحة.
 */
function ChartPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-dark">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        {action}
      </div>

      <div dir="ltr" className="h-72 w-full">
        {children}
      </div>
    </section>
  );
}

const AXIS_TICK = { fill: "var(--chart-axis)", fontSize: 12 };

/**
 * معدّل التسميع الشهري — سلسلة واحدة، فلا صندوق دلالات (legend):
 * العنوان يسمّي المرسوم، وصندوقٌ بمربّع واحد يكرّره ويأكل المساحة.
 */
function RecitationChart({ points }: { points: Stats["monthlyRecitation"] }) {
  const { t } = useTranslation();

  if (points.length === 0) {
    return (
      <ChartPanel
        title={t("statistics.recitationChart.title")}
        subtitle={t("statistics.recitationChart.subtitle")}
      >
        <EmptyState message={t("statistics.noRecitations")} icon="📖" />
      </ChartPanel>
    );
  }

  return (
    <ChartPanel
      title={t("statistics.recitationChart.title")}
      subtitle={t("statistics.recitationChart.subtitle")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          {/* شبكة أفقية فقط وبخطّ شعري متّصل: مرجعٌ للقيم لا زخرفة */}
          <CartesianGrid stroke="var(--chart-grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            minTickGap={16}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatNumber}
          />
          <Tooltip
            content={<RecitationTooltip />}
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          />
          {/*
           * خطّ 2px ونقاط نصف قطرها 4 (‏8px) بحلقة بلون السطح — الحلقة
           * جزء من هدف التأشير لا مجرّد فراغ، فتبقى النقطة قابلة
           * للإمساك حيث تتقاطع مع الخطّ.
           */}
          <Line
            type="monotone"
            dataKey="pages"
            stroke="var(--chart-recitation)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={{
              r: 4,
              fill: "var(--chart-recitation)",
              stroke: "var(--chart-surface)",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 6,
              fill: "var(--chart-recitation)",
              stroke: "var(--chart-surface)",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

/**
 * ناجحو الأوقاف — نفس المقياس بحبيبتين زمنيّتين، يبدّل بينهما مفتاح.
 *
 * لا يُخلط الشهري بالسنوي على محور واحد: عمود سنةٍ بجانب عمود شهرٍ
 * يقارن قيمتين مجموعتين على مدَيَين مختلفين تماماً.
 */
function AwqafChart({ stats }: { stats: Stats["awqafStats"] }) {
  const { t } = useTranslation();
  const [grain, setGrain] = useState<"month" | "year">("month");

  /*
   * الفرعان يُسوَّيان على شكل واحد (label + الأعداد): لو بقي `month` في
   * أحدهما و`year` في الآخر لاختلف نوع الصفّ باختلاف المفتاح، ولا يقبل
   * المخطّط مصفوفةً يتبدّل شكل صفوفها.
   */
  const rows = (
    grain === "month"
      ? stats.byMonth.map((row) => ({ ...row, label: formatMonth(row.month) }))
      : stats.byYear.map((row) => ({ ...row, label: row.year }))
  ).map(({ label, passed, nominated, failed, total }) => ({
    label,
    passed,
    nominated,
    failed,
    total,
  }));

  const toggle = (
    <div className="flex shrink-0 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-light">
      {(["month", "year"] as const).map((option) => (
        <button
          key={option}
          onClick={() => setGrain(option)}
          className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
            grain === option
              ? "bg-white text-gray-800 shadow dark:bg-dark dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          {t(`statistics.grain.${option}`)}
        </button>
      ))}
    </div>
  );

  if (rows.length === 0) {
    return (
      <ChartPanel
        title={t("statistics.awqafChart.title")}
        subtitle={t("statistics.awqafChart.subtitle")}
        action={toggle}
      >
        <EmptyState message={t("statistics.noAwqaf")} icon="🎓" />
      </ChartPanel>
    );
  }

  return (
    <ChartPanel
      title={t("statistics.awqafChart.title")}
      subtitle={t("statistics.awqafChart.subtitle")}
      action={toggle}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            minTickGap={8}
          />
          {/*
           * عدد الناجحين صحيح لا كسريّ: allowDecimals=false يمنع علامات
           * مثل 0.5 ناجح على المحور حين تكون القيم صغيرة.
           */}
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip content={<AwqafTooltip />} cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }} />
          {/*
           * عمود ‎≤24px برأس مستدير 4px وقاعدة قائمة على خطّ الأساس،
           * والفراغ المتبقي من الشريحة يبقى هواءً لا يملؤه العمود.
           */}
          <Bar
            dataKey="passed"
            fill="var(--chart-awqaf)"
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

/* ==================== تلميحات التأشير ==================== */

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { payload: Record<string, unknown> }[];
}

/** صندوق التلميح — شكل واحد للمخطّطين. */
function TooltipBox({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div
      dir="auto"
      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-600 dark:bg-dark"
    >
      <p className="mb-1 font-bold text-gray-800 dark:text-white">{title}</p>
      {rows.map(([key, value]) => (
        <p key={key} className="flex justify-between gap-4 text-gray-600 dark:text-gray-300">
          <span>{key}</span>
          <span className="font-bold text-gray-800 dark:text-white">{value}</span>
        </p>
      ))}
    </div>
  );
}

function RecitationTooltip({ active, payload }: TooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  const row = payload[0].payload as { month: string; pages: number; count: number };
  return (
    <TooltipBox
      title={formatMonth(row.month)}
      rows={[
        [t("statistics.recitationChart.pages"), formatNumber(row.pages)],
        [t("statistics.recitationChart.count"), formatNumber(row.count)],
      ]}
    />
  );
}

/**
 * التلميح يحمل التفصيل الكامل (مرشّح/ناجح/لم ينجح) بينما يرسم العمود
 * الناجحين وحدهم: الترميز الأساسي يبقى مقياساً واحداً مقروءاً، والتفصيل
 * متاح عند الطلب بلا ازدحام.
 */
function AwqafTooltip({ active, label, payload }: TooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;

  const row = payload[0].payload as {
    passed: number;
    nominated: number;
    failed: number;
    total: number;
  };

  return (
    <TooltipBox
      title={String(label ?? "")}
      rows={[
        [t("awqafStatuses.passed"), formatNumber(row.passed)],
        [t("awqafStatuses.nominated"), formatNumber(row.nominated)],
        [t("awqafStatuses.failed"), formatNumber(row.failed)],
        [t("statistics.awqafChart.total"), formatNumber(row.total)],
      ]}
    />
  );
}

/**
 * أرقام لاتينية بفواصل آلاف — كبقية أرقام الواجهة (النقاط والصفحات).
 * الكسور تُعرض عند وجودها فقط: 369.5 صفحة تبقى دقيقة، و52 يوماً لا
 * تصير "52.00".
 */
function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
