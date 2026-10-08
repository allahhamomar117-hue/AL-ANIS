import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaTrophy } from "react-icons/fa";
import { Maximize, Minimize2, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { DEPARTMENTS, type Department } from "../../lib/api/types";
import { useAuth } from "../../context/authContext";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";
import Avatar from "../../shared/Avatar";
import Podium from "./Podium";

type LeaderboardType = "points" | "attendance" | "recitation";
type LeaderboardResult = Awaited<ReturnType<typeof reportsApi.leaderboard>>;
type Student = LeaderboardResult["data"][number];

/**
 * وضع التلفاز يعرض عدداً محدوداً من الصفوف حتى تبقى المسافات واضحة على الشاشات الكبيرة.
 * كل عمود يحتوي على خمسة صفوف كحد أقصى (إجمالي 10 صفوف).
 */
const TV_REST_LIMIT = 10;

/** تحديث تلقائي في وضع التلفاز: الشاشة تبقى مفتوحة أمام الطلاب ولا أحد يضغط "تحديث". */
const TV_REFRESH_MS = 60_000;

/**
 * مظهر شاشة التلفاز — مستقلّ عن وضع التطبيق، ومحفوظ في المتصفح نفسه:
 * التلفاز جهازٌ واحد يُضبط مرّة، فيُفتح على ما اختير آخر مرّة.
 * الافتراضي فاتح.
 */
type TvTheme = "light" | "dark";
const TV_THEME_KEY = "leaderboard.tvTheme";

function readTvTheme(): TvTheme {
  try {
    return localStorage.getItem(TV_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** حركة الظهور: تتلاشى وتصعد، متتابعة حسب الترتيب. تُلغى لمن يفضّل تقليل الحركة. */
const enter =
  "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both motion-reduce:animate-none";
const delay = (i: number) => ({ animationDelay: `${i * 60}ms` });

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { isTeacher, isViewer, halaqaName, departments } = useAuth();

  const [type, setType] = useState<LeaderboardType>("points");
  const [department, setDepartment] = useState<Department | "">("");
  // حساب شاشة العرض يُفتح على وضع التلفاز مباشرةً — هذه وظيفته الوحيدة
  const [tvMode, setTvMode] = useState(isViewer);
  const [tvTheme, setTvTheme] = useState<TvTheme>(readTvTheme);

  const toggleTvTheme = () => {
    const next: TvTheme = tvTheme === "dark" ? "light" : "dark";
    setTvTheme(next);
    try {
      localStorage.setItem(TV_THEME_KEY, next);
    } catch {
      // تخزين محجوب (نافذة خاصة): يعمل المفتاح للجلسة الحالية وحدها
    }
  };

  /*
   * الدورات المعروضة في الفلتر: أقسام المستخدم، أو الثلاث كلّها لمن نطاقه
   * المعهد كلّه (قائمته فارغة). المدرّس بلا فلتر — نطاقه حلقاته، والخادم
   * يقصر لوحة الصدارة عليها أصلاً.
   *
   * من الثوابت لا من استعلام: الدورات ثلاث قيم ثابتة في المشروع (لا جدول
   * لها)، والفلتر تضييقٌ فوق نطاق الخادم لا يكشف شيئاً خارجه.
   */
  const departmentOptions: readonly Department[] = isTeacher
    ? []
    : departments.length
      ? departments
      : DEPARTMENTS;

  /**
   * الخادم يرجّع الأعمدة الثلاثة في كل طلب ويرتّب حسب `type`،
   * لذا تبديل التبويب لا يحتاج إلا إعادة الترتيب من الخادم.
   */
  /*
   * بلا limit: الصفحة تعرض ترتيب الطلاب كلّهم.
   *
   * كان الحدّ خمسين، فيقف الجدول عند الخمسين ولا شيء في الصفحة يقول إن
   * بعدهم بقيّة — فيقرأ المستخدم غيابَ طالبٍ على أنه لم يُسجَّل له شيء.
   * والخادم يقصر النتيجة على نطاق المستخدم وعلى الدورة الجارية أصلاً،
   * فالقائمة محدودة بعدد طلاب المركز لا مفتوحة.
   */
  const params = {
    type,
    department: isTeacher || department === "" ? undefined : department,
  };

  const leaderboard = useQuery({
    queryKey: qk.reports.leaderboard(params),
    queryFn: () => reportsApi.leaderboard(params),
    select: (res) => res.data,
    refetchInterval: tvMode ? TV_REFRESH_MS : false,
  });

  const students = leaderboard.data ?? [];
  const topThree = students.slice(0, 3);
  const restOfStudents = students.slice(3);

  const label =
    type === "points"
      ? t("leaderboard.labels.totalPoints")
      : type === "attendance"
        ? t("leaderboard.labels.attendance")
        : t("leaderboard.labels.recitation");

  const valueOf = (student: Student) => {
    if (type === "attendance") return `${student.attendance}%`;
    // التسميع يُقاس بالصفحات: الكسور تظهر كما هي (نصف صفحة، أو وزن سورة قصيرة)
    if (type === "recitation")
      return t("leaderboard.pagesValue", { pages: student.recitationPages });
    return student.points;
  };

  /** تحت النسبة: كم يوماً حضر من كم يوم دوام — النسبة وحدها لا تُظهر الحجم. */
  const daysOf = (student: Student) =>
    type === "attendance"
      ? t("leaderboard.attendedOfDays", {
          attended: student.attendedDays,
          days: t("common.days", { count: student.totalDays }),
        })
      : null;

  /** اسم النطاق المعروض: حلقة المدرّس، أو الدورة المختارة، أو «كل الدورات». */
  const scopeName = isTeacher
    ? halaqaName
    : department
      ? t(`departments.${department}`)
      : departmentOptions.length === 1
        ? t(`departments.${departmentOptions[0]}`)
        : t("leaderboard.filterDepartment");

  /* ---------------- وضع التلفاز ---------------- */

  /**
   * هل دخل ملءَ الشاشة مع وضع التلفاز نفسه؟ عندها يُنهي الخروجُ منه (Esc
   * من المتصفح) وضعَ التلفاز أيضاً. أمّا ملء الشاشة من زرّه داخل الوضع
   * — وهو سبيل حساب العرض إليه — فالخروج منه يُبقي الوضع قائماً.
   */
  const fullscreenWithTv = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(document.fullscreenElement),
  );

  const exitTv = useCallback(() => {
    setTvMode(false);
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    fullscreenWithTv.current = false;
  }, []);

  const requestFullscreen = () =>
    document.documentElement.requestFullscreen?.() ??
    Promise.reject(new Error("unsupported"));

  const enterTv = () => {
    setTvMode(true);
    // ملء الشاشة تحسين لا شرط: الطبقة نفسها تغطّي الشاشة كلها لو رفضه المتصفح
    requestFullscreen()
      .then(() => (fullscreenWithTv.current = true))
      .catch(() => {});
  };

  useEffect(() => {
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active && fullscreenWithTv.current) exitTv();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [exitTv]);

  useEffect(() => {
    if (!tvMode) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exitTv();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [tvMode, exitTv]);

  /*
   * مظهر التلفاز يُطبَّق على <html> مدّة الوضع، ثم يُعاد وضعُ التطبيق كما كان.
   *
   * لماذا على <html> لا على الطبقة نفسها؟ متغيّر dark: في المشروع هو
   * `.dark *`، فالتطبيق الداكن (صنف dark على <html>) يُظلم كلَّ ما تحته
   * ولا سبيل لاستثناء الطبقة منه. وتعديل المتغيّر نفسه يحتاج :not() مركّباً
   * لا تفهمه متصفّحات التلفاز القديمة — فيسقط الوضع الداكن في التطبيق كلّه.
   */
  useEffect(() => {
    if (!tvMode) return;
    const root = document.documentElement;
    const appDark = root.classList.contains("dark");
    const nextDark = tvTheme === "dark";

    root.classList.toggle("dark", nextDark);
    root.dataset.tvTheme = tvTheme;

    return () => {
      root.classList.toggle("dark", appDark);
      delete root.dataset.tvTheme;
    };
  }, [tvMode, tvTheme]);

  /* ---------------- أجزاء العرض ---------------- */

  const rankGrid = (list: Student[], tv: boolean) => {
    // ترتيب عمودي: يُقرأ العمود الأول من أعلى لأسفل ثم الثاني — أطبع لقراءة الترتيب
    const rows = Math.ceil(list.length / 2);
    return (
      <div
        style={{ "--rows": rows } as React.CSSProperties}
        className={`grid gap-2 md:grid-cols-2 md:grid-flow-col ${
          tv
            ? "min-h-0 flex-1 grid-cols-2 grid-flow-col gap-x-5 gap-y-[1.1vh] grid-rows-[repeat(var(--rows),minmax(0,1fr))]"
            : "mx-auto max-w-6xl md:grid-rows-[repeat(var(--rows),auto)]"
        }`}
      >
        {list.map((student, i) => (
          <div
            key={`${type}-${student.id}`}
            style={delay(Math.min(i, 20) + 8)}
            className={`flex min-h-0 items-center gap-3 rounded-2xl border transition-all ${enter} ${
              tv
                ? "min-h-[clamp(3.1rem,5.2vh,4.75rem) border-slate-200/90 bg-white/90 px-4 py-1.5 shadow-[0_3px_18px_rgba(15,23,42,0.08)] backdrop-blur-md " +
                  "dark:border-white/10 dark:bg-slate-900/80 dark:shadow-[0_3px_20px_rgba(0,0,0,0.25)]"
                : "bg-white px-3 py-2 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-dark dark:hover:bg-dark-light/20"
            }`}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-600
                shadow-inner dark:bg-gray-700/70 dark:text-gray-200 ${
                  tv
                    ? "size-[clamp(1.9rem,4vh,2.7rem)] text-[clamp(0.9rem,2vh,1.15rem)]"
                    : "size-8 text-sm"
                }`}
            >
              {student.rank}
            </span>
            <Avatar
              name={student.name}
              url={student.avatarUrl}
              className={`shrink-0 rounded-full ring-2 ring-white/80 dark:ring-slate-900/80 ${
                tv ? "size-[clamp(2rem,4.4vh,3rem)]" : "size-9"
              }`}
            />
            <div className="min-w-0 flex-1">
              <h3
                className={`truncate font-bold leading-tight text-slate-900 dark:text-white ${
                  tv ? "text-[clamp(0.95rem,2.15vh,1.35rem)]" : "text-sm"
                }`}
              >
                {student.name}
              </h3>
              <p
                className={`truncate text-gray-500 dark:text-gray-400 ${
                  tv ? "text-[clamp(0.72rem,1.5vh,0.9rem)]" : "text-xs"
                }`}
              >
                {student.group}
              </p>
            </div>
            <div className="shrink-0 text-center">
              <p
                className={`font-black leading-none text-emerald-600 dark:text-emerald-400 ${
                  tv ? "text-[clamp(1.1rem,2.8vh,1.7rem)]" : "text-lg"
                }`}
              >
                {valueOf(student)}
              </p>
              {daysOf(student) && (
                <span
                  className={`block text-gray-400 dark:text-gray-500 ${tv ? "text-[0.7rem]" : "text-[10px]"}`}
                >
                  {daysOf(student)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const content = (tv: boolean) =>
    leaderboard.isPending ? (
      <LoadingState />
    ) : leaderboard.isError ? (
      <ErrorState
        error={leaderboard.error}
        onRetry={() => void leaderboard.refetch()}
      />
    ) : students.length === 0 ? (
      <EmptyState message={t("leaderboard.empty")} icon="🏆" />
    ) : (
      <>
        <Podium
          students={topThree}
          tv={tv}
          animationKey={`${type}-${params.department ?? "all"}`}
          valueOf={valueOf}
          captionOf={(s) => daysOf(s) ?? label}
        />
        {rankGrid(
          tv ? restOfStudents.slice(0, TV_REST_LIMIT) : restOfStudents,
          tv,
        )}
      </>
    );

  const tvButton =
    "rounded-xl bg-slate-900/5 p-2.5 text-slate-500 opacity-60 transition hover:bg-slate-900/10 hover:text-slate-900 " +
    "hover:opacity-100 dark:bg-white/5 dark:text-gray-400 dark:opacity-40 dark:hover:bg-white/15 dark:hover:text-white";

  /*
   * طبقة ثابتة فوق كل شيء (فوق شريط التنقّل العلوي والسفلي) بدل تعديل MainLayout.
   * مظهرها من tvTheme (راجع التأثير أعلاه): فاتحٌ عاجيّ افتراضاً، وداكنٌ ليليّ.
   */
  const tvOverlay = createPortal(
    <div
      className="fixed inset-0 z-100 flex flex-col gap-[1.5vh] overflow-hidden p-4 text-right font-['Cairo'] text-slate-900
        transition-colors duration-500 lg:px-6 dark:text-white
        bg-[radial-gradient(ellipse_at_top,#fef3c7_0%,#fffbeb_25%,#f8fafc_60%,#e2e8f0_100%)]
        dark:bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#0b1220_50%,#05080f_100%)]"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 motion-reduce:animate-none">
        <div className="flex min-w-0 items-center gap-3">
          <FaTrophy
            className="shrink-0 text-3xl text-amber-500 drop-shadow-[0_2px_6px_rgba(217,119,6,0.4)]
              dark:text-yellow-400 dark:drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]"
          />
          <h1 className="truncate text-3xl font-black text-slate-900 lg:text-4xl dark:text-white">
            {t("leaderboard.title")}
          </h1>
          <span
            className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-base font-bold text-amber-800 ring-1 ring-amber-300
              dark:bg-yellow-400/15 dark:text-yellow-200 dark:ring-yellow-400/40"
          >
            {label}
          </span>
          {scopeName && (
            <span
              className="shrink-0 rounded-full bg-white px-3 py-1 text-base font-bold text-slate-700 shadow-sm ring-1 ring-slate-200
                dark:bg-white/10 dark:text-gray-200 dark:shadow-none dark:ring-0"
            >
              {scopeName}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeSwitch
            dark={tvTheme === "dark"}
            onToggle={toggleTvTheme}
            label={t(
              tvTheme === "dark"
                ? "leaderboard.tv.lightMode"
                : "leaderboard.tv.darkMode",
            )}
          />
          {/* ملء الشاشة لا يُطلب إلا بنقرة: حساب العرض يدخل الوضع تلقائياً بلا نقرة، فيحتاج هذا الزر */}
          {!isFullscreen && (
            <button
              onClick={() => void requestFullscreen().catch(() => {})}
              title={t("leaderboard.tv.fullscreen")}
              aria-label={t("leaderboard.tv.fullscreen")}
              className={tvButton}
            >
              <Maximize className="size-5" />
            </button>
          )}
          <button
            onClick={exitTv}
            title={t("leaderboard.tv.exit")}
            aria-label={t("leaderboard.tv.exit")}
            className={tvButton}
          >
            <Minimize2 className="size-5" />
          </button>
        </div>
      </header>
      {content(true)}
    </div>,
    document.body,
  );

  return (
    <div className="min-h-screen dark:bg-dark-light p-4 md:p-8 dir-rtl text-right font-['Cairo'] pt-20 md:pt-24">
      {tvMode && tvOverlay}

      {/* Header */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 dark:text-white">
            {t("leaderboard.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-300 mt-1">
            {t("leaderboard.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* فلترة بالدورة — لمن نطاقه أكثر من دورة واحدة */}
          {departmentOptions.length > 1 ? (
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department | "")}
              className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark px-4 py-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">{t("leaderboard.filterDepartment")}</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {t(`departments.${d}`)}
                </option>
              ))}
            </select>
          ) : (
            scopeName && (
              <span className="rounded-xl bg-emerald-100 px-4 py-2 font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {scopeName}
              </span>
            )
          )}

          <button
            onClick={enterTv}
            title={t("leaderboard.tv.enter")}
            aria-label={t("leaderboard.tv.enter")}
            className="rounded-xl border border-gray-300 bg-white p-2.5 text-gray-600 transition hover:border-emerald-400 hover:text-emerald-500
              dark:border-gray-600 dark:bg-dark dark:text-gray-300"
          >
            <Monitor className="size-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto mb-6 bg-white dark:bg-dark border dark:border-gray-700 rounded-xl p-1 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "points", label: t("leaderboard.tabs.points") },
            { key: "attendance", label: t("leaderboard.tabs.attendance") },
            { key: "recitation", label: t("leaderboard.tabs.recitation") },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setType(tab.key as LeaderboardType)}
              className={`w-full px-6 py-3 rounded-lg font-medium transition
            ${
              type === tab.key
                ? "bg-emerald-400 text-white shadow-md"
                : "text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-light/20"
            }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {content(false)}
    </div>
  );
};

/**
 * مفتاح الفاتح/الداكن لشاشة التلفاز: كبسولة بمقبض ينزلق بين شمسٍ وقمر.
 * الموضع منطقيّ (start) لا أيمن/أيسر، فينزلق المقبض في الاتجاه الصحيح
 * بالعربية والإنجليزية معاً.
 */
function ThemeSwitch({
  dark,
  onToggle,
  label,
}: {
  dark: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className="relative h-9 w-17 shrink-0 rounded-full bg-amber-100 shadow-inner ring-1 ring-amber-300 transition-colors
        duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500
        dark:bg-slate-800 dark:ring-white/15"
    >
      {/* الأيقونتان الخافتتان على طرفي الكبسولة */}
      <Sun className="absolute start-2 top-1/2 size-4 -translate-y-1/2 text-amber-400/70" />
      <Moon className="absolute end-2 top-1/2 size-4 -translate-y-1/2 text-slate-400/60 dark:text-slate-400" />
      <span
        className={`absolute top-1 flex size-7 items-center justify-center rounded-full shadow-md transition-all duration-300
          ${dark ? "start-[calc(100%-2rem)] bg-slate-950 text-yellow-200" : "start-1 bg-white text-amber-500"}`}
      >
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
    </button>
  );
}

export default Reports;
