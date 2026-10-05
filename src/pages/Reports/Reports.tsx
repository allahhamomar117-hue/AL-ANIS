import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaTrophy } from "react-icons/fa";
import { Maximize, Minimize2, Monitor } from "lucide-react";
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
 * وضع التلفاز يعرض المراكز من الرابع حتى هذا العدد بعده (٤–١٩):
 * عمودان × ثمانية صفوف تتّسع لها شاشة 1080p تحت منصّة المراكز الثلاثة بلا تمرير.
 */
const TV_REST_LIMIT = 16;

/** تحديث تلقائي في وضع التلفاز: الشاشة تبقى مفتوحة أمام الطلاب ولا أحد يضغط "تحديث". */
const TV_REFRESH_MS = 60_000;

/** حركة الظهور: تتلاشى وتصعد، متتابعة حسب الترتيب. تُلغى لمن يفضّل تقليل الحركة. */
const enter = "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both motion-reduce:animate-none";
const delay = (i: number) => ({ animationDelay: `${i * 60}ms` });

const Reports: React.FC = () => {
  const { t } = useTranslation();
  const { isTeacher, isViewer, halaqaName, departments } = useAuth();

  const [type, setType] = useState<LeaderboardType>("points");
  const [department, setDepartment] = useState<Department | "">("");
  // حساب شاشة العرض يُفتح على وضع التلفاز مباشرةً — هذه وظيفته الوحيدة
  const [tvMode, setTvMode] = useState(isViewer);

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
    if (type === "recitation") return t("leaderboard.pagesValue", { pages: student.recitationPages });
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
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));

  const exitTv = useCallback(() => {
    setTvMode(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    fullscreenWithTv.current = false;
  }, []);

  const requestFullscreen = () =>
    document.documentElement.requestFullscreen?.() ?? Promise.reject(new Error("unsupported"));

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

  /* ---------------- أجزاء العرض ---------------- */

  const rankGrid = (list: Student[], tv: boolean) => {
    // ترتيب عمودي: يُقرأ العمود الأول من أعلى لأسفل ثم الثاني — أطبع لقراءة الترتيب
    const rows = Math.ceil(list.length / 2);
    return (
      <div
        style={{ "--rows": rows } as React.CSSProperties}
        className={`grid gap-2 md:grid-cols-2 md:grid-flow-col ${
          tv
            ? "min-h-0 flex-1 gap-x-4 gap-y-[0.8vh] grid-cols-2 grid-flow-col grid-rows-[repeat(var(--rows),minmax(0,1fr))] max-h-[calc(var(--rows)*5.5rem)]"
            : "mx-auto max-w-6xl md:grid-rows-[repeat(var(--rows),auto)]"
        }`}
      >
        {list.map((student, i) => (
          <div
            key={`${type}-${student.id}`}
            style={delay(Math.min(i, 20) + 8)}
            className={`flex min-h-0 items-center gap-3 rounded-xl border bg-white shadow-sm transition-colors
              hover:bg-gray-50 dark:border-gray-700 dark:bg-dark dark:hover:bg-dark-light/20 ${enter} ${
                tv ? "px-4 py-0.5 dark:border-white/10 dark:bg-white/5" : "px-3 py-2"
              }`}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-lg bg-gray-100 font-black text-gray-500
                dark:bg-gray-700/70 dark:text-gray-200 ${
                  tv ? "size-[clamp(1.75rem,3.8vh,2.5rem)] text-[clamp(0.9rem,2vh,1.15rem)]" : "size-8 text-sm"
                }`}
            >
              {student.rank}
            </span>
            <Avatar
              name={student.name}
              url={student.avatarUrl}
              className={`shrink-0 ${tv ? "size-[clamp(1.75rem,4.2vh,2.75rem)]" : "size-9"}`}
            />
            <div className="min-w-0 flex-1">
              <h3
                className={`truncate font-bold leading-tight dark:text-white ${
                  tv ? "text-[clamp(0.95rem,2.1vh,1.3rem)]" : "text-sm"
                }`}
              >
                {student.name}
              </h3>
              <p
                className={`truncate text-gray-500 dark:text-gray-400 ${
                  tv ? "text-[clamp(0.7rem,1.4vh,0.875rem)]" : "text-xs"
                }`}
              >
                {student.group}
              </p>
            </div>
            <div className="shrink-0 text-center">
              <p
                className={`font-black leading-none text-emerald-500 dark:text-emerald-400 ${
                  tv ? "text-[clamp(1.1rem,2.6vh,1.6rem)]" : "text-lg"
                }`}
              >
                {valueOf(student)}
              </p>
              {daysOf(student) && (
                <span className={`text-gray-400 dark:text-gray-500 ${tv ? "text-xs" : "text-[10px]"}`}>
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
      <ErrorState error={leaderboard.error} onRetry={() => void leaderboard.refetch()} />
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
        {rankGrid(tv ? restOfStudents.slice(0, TV_REST_LIMIT) : restOfStudents, tv)}
      </>
    );

  /*
   * طبقة ثابتة فوق كل شيء (فوق شريط التنقّل العلوي والسفلي) بدل تعديل MainLayout.
   * صنف `dark` عليها يفعّل أصناف dark: لما بداخلها — شاشة العرض داكنة دائماً.
   */
  const tvOverlay = createPortal(
    <div
      className="dark fixed inset-0 z-100 flex flex-col gap-[1.5vh] overflow-hidden p-4 text-right font-['Cairo'] lg:px-6
        bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#0b1220_50%,#05080f_100%)]"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 motion-reduce:animate-none">
        <div className="flex min-w-0 items-center gap-3">
          <FaTrophy className="shrink-0 text-3xl text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" />
          <h1 className="truncate text-3xl font-black text-white lg:text-4xl">{t("leaderboard.title")}</h1>
          <span className="shrink-0 rounded-full bg-yellow-400/15 px-3 py-1 text-base font-bold text-yellow-200 ring-1 ring-yellow-400/40">
            {label}
          </span>
          {scopeName && (
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-base font-bold text-gray-200">
              {scopeName}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* ملء الشاشة لا يُطلب إلا بنقرة: حساب العرض يدخل الوضع تلقائياً بلا نقرة، فيحتاج هذا الزر */}
          {!isFullscreen && (
            <button
              onClick={() => void requestFullscreen().catch(() => {})}
              title={t("leaderboard.tv.fullscreen")}
              aria-label={t("leaderboard.tv.fullscreen")}
              className="rounded-xl bg-white/5 p-2.5 text-gray-400 opacity-40 transition hover:bg-white/15 hover:text-white hover:opacity-100"
            >
              <Maximize className="size-5" />
            </button>
          )}
          <button
            onClick={exitTv}
            title={t("leaderboard.tv.exit")}
            aria-label={t("leaderboard.tv.exit")}
            className="rounded-xl bg-white/5 p-2.5 text-gray-400 opacity-40 transition hover:bg-white/15 hover:text-white hover:opacity-100"
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
          <p className="text-gray-500 dark:text-gray-300 mt-1">{t("leaderboard.subtitle")}</p>
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

export default Reports;
