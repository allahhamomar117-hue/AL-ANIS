import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaUser, FaCrown, FaTrophy } from "react-icons/fa";
import { Monitor, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../../lib/api";
import { qk } from "../../lib/api/queryKeys";
import { useHalaqat } from "../../lib/api/hooks";
import { useCurrentHalaqa } from "../../lib/api/useCurrentHalaqa";
import { EmptyState, ErrorState, LoadingState } from "../../shared/QueryState";
import Avatar from "../../shared/Avatar";

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

/** ألوان الميداليات: حدّ + توهّج + شارة المركز لكل من الذهبي والفضي والبرونزي. */
const MEDALS: Record<number, { border: string; glow: string; halo: string; badge: string; order: string }> = {
  1: {
    border: "border-yellow-400/90",
    glow: "shadow-[0_0_18px_rgba(250,204,21,0.55),0_0_48px_rgba(250,204,21,0.25)]",
    halo: "bg-yellow-400/40 animate-pulse",
    badge: "bg-gradient-to-br from-yellow-200 via-yellow-400 to-amber-500 text-amber-950",
    order: "order-2 md:-translate-y-3",
  },
  2: {
    border: "border-slate-300/90",
    glow: "shadow-[0_0_16px_rgba(203,213,225,0.55),0_0_40px_rgba(203,213,225,0.2)]",
    halo: "bg-slate-300/30",
    badge: "bg-gradient-to-br from-white via-slate-200 to-slate-400 text-slate-800",
    order: "order-1",
  },
  3: {
    border: "border-orange-400/90",
    glow: "shadow-[0_0_16px_rgba(205,127,50,0.6),0_0_40px_rgba(205,127,50,0.22)]",
    halo: "bg-orange-500/30",
    badge: "bg-gradient-to-br from-orange-200 via-orange-400 to-amber-700 text-white",
    order: "order-3",
  },
};

/** حركة الظهور: تتلاشى وتصعد، متتابعة حسب الترتيب. تُلغى لمن يفضّل تقليل الحركة. */
const enter = "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both motion-reduce:animate-none";
const delay = (i: number) => ({ animationDelay: `${i * 60}ms` });

const Reports: React.FC = () => {
  const [type, setType] = useState<LeaderboardType>("points");
  const [halaqaId, setHalaqaId] = useState<number | "">("");
  const [tvMode, setTvMode] = useState(false);
  const { t } = useTranslation();

  const { data: halaqat = [] } = useHalaqat();
  const current = useCurrentHalaqa();

  /**
   * الخادم يرجّع الأعمدة الثلاثة في كل طلب ويرتّب حسب `type`،
   * لذا تبديل التبويب لا يحتاج إلا إعادة الترتيب من الخادم.
   */
  /*
   * المدرّس: بلا مرشّح حلقة — الخادم يقصر لوحة الصدارة على نطاقه أصلاً.
   * تمرير حلقته الافتراضية وحدها كان يُسقط طلاب حلقاته الأخرى من الترتيب.
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
    halaqaId: current.isTeacher ? undefined : halaqaId === "" ? undefined : halaqaId,
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

  /* ---------------- وضع التلفاز ---------------- */

  /** هل دخلنا ملء الشاشة فعلاً؟ الخروج منه (Esc من المتصفح) يُنهي وضع التلفاز أيضاً. */
  const enteredFullscreen = useRef(false);

  const exitTv = useCallback(() => {
    setTvMode(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    enteredFullscreen.current = false;
  }, []);

  const enterTv = () => {
    setTvMode(true);
    // ملء الشاشة تحسين لا شرط: الطبقة نفسها تغطّي الشاشة كلها لو رفضه المتصفح
    document.documentElement
      .requestFullscreen?.()
      .then(() => (enteredFullscreen.current = true))
      .catch(() => {});
  };

  useEffect(() => {
    if (!tvMode) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exitTv();
    const onFsChange = () => {
      if (!document.fullscreenElement && enteredFullscreen.current) exitTv();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [tvMode, exitTv]);

  const scopeName = current.showHalaqaPicker
    ? (halaqat.find((h) => h.id === halaqaId)?.name ?? t("leaderboard.filterHalaqa"))
    : current.halaqaName;

  /* ---------------- أجزاء العرض ---------------- */

  const podium = (tv: boolean) => (
    <div
      className={`mx-auto flex w-full items-end justify-center gap-3 md:gap-6 ${
        tv ? "max-w-5xl pt-4" : "max-w-4xl mb-8 px-2 pt-3"
      }`}
    >
      {topThree.map((student, i) => {
        const medal = MEDALS[student.rank] ?? MEDALS[3];
        const first = student.rank === 1;
        return (
          <div
            key={`${type}-${student.id}`}
            style={delay(first ? 0 : i + 1)}
            className={`relative isolate flex-1 ${medal.order} ${enter} ${
              first ? "zoom-in-90" : ""
            }`}
          >
            {/* هالة ضوئية خلف البطاقة */}
            <div className={`absolute -inset-1 -z-10 rounded-3xl blur-xl ${medal.halo}`} />
            <div
              className={`rounded-2xl border-2 bg-white text-center dark:bg-dark ${medal.border} ${medal.glow} ${
                tv
                  ? first
                    ? "px-4 py-5 dark:bg-slate-900/80"
                    : "px-4 py-4 dark:bg-slate-900/80"
                  : first
                    ? "p-3 md:p-5"
                    : "p-3 md:p-4"
              }`}
            >
              <div className="relative mb-2 inline-block">
                {student.avatarUrl ? (
                  <Avatar
                    name={student.name}
                    url={student.avatarUrl}
                    className={`mx-auto ${
                      tv ? (first ? "size-24" : "size-20") : first ? "size-14 md:size-20" : "size-12 md:size-16"
                    }`}
                    textClassName={tv ? "text-3xl" : "text-xl md:text-2xl"}
                  />
                ) : (
                  <div
                    className={`mx-auto flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 ${
                      tv ? (first ? "size-24" : "size-20") : first ? "size-14 md:size-20" : "size-12 md:size-16"
                    }`}
                  >
                    {first ? (
                      <FaCrown className="text-2xl text-yellow-400 md:text-3xl" />
                    ) : (
                      <FaUser className="text-xl text-gray-400 dark:text-gray-300 md:text-2xl" />
                    )}
                  </div>
                )}

                {/* التاج يبقى ظاهراً فوق صورة صاحب المركز الأول */}
                {first && student.avatarUrl && (
                  <FaCrown className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg text-yellow-400 drop-shadow md:text-2xl" />
                )}
                <div
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 font-black shadow ${medal.badge} ${
                    tv ? "text-sm" : "text-[10px] md:text-xs"
                  }`}
                >
                  #{student.rank}
                </div>
              </div>
              <h2
                className={`truncate font-bold dark:text-white ${
                  tv ? (first ? "text-2xl" : "text-xl") : "text-xs md:text-lg"
                }`}
              >
                {student.name}
              </h2>
              <div
                className={`font-black text-emerald-500 dark:text-emerald-300 ${
                  tv ? (first ? "text-4xl mt-1" : "text-3xl mt-1") : "text-lg md:text-2xl mt-1"
                }`}
              >
                {valueOf(student)}
              </div>
              <span
                className={`font-bold text-gray-400 dark:text-gray-300 ${tv ? "text-sm" : "text-[10px] md:text-xs"}`}
              >
                {daysOf(student) ?? label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const rankGrid = (list: Student[], tv: boolean) => {
    // ترتيب عمودي: يُقرأ العمود الأول من أعلى لأسفل ثم الثاني — أطبع لقراءة الترتيب
    const rows = Math.ceil(list.length / 2);
    return (
      <div
        style={{ "--rows": rows } as React.CSSProperties}
        className={`grid gap-2 md:grid-cols-2 md:grid-flow-col ${
          tv
            ? "min-h-0 flex-1 gap-x-4 gap-y-2 grid-cols-2 grid-flow-col grid-rows-[repeat(var(--rows),minmax(0,1fr))] max-h-[calc(var(--rows)*5.5rem)]"
            : "mx-auto max-w-6xl md:grid-rows-[repeat(var(--rows),auto)]"
        }`}
      >
        {list.map((student, i) => (
          <div
            key={`${type}-${student.id}`}
            style={delay(Math.min(i, 20) + 3)}
            className={`flex min-h-0 items-center gap-3 rounded-xl border bg-white shadow-sm transition-colors
              hover:bg-gray-50 dark:border-gray-700 dark:bg-dark dark:hover:bg-dark-light/20 ${enter} ${
                tv ? "px-4 py-1 dark:border-white/10 dark:bg-white/5" : "px-3 py-2"
              }`}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-lg bg-gray-100 font-black text-gray-500
                dark:bg-gray-700/70 dark:text-gray-200 ${tv ? "size-10 text-lg" : "size-8 text-sm"}`}
            >
              {student.rank}
            </span>
            <Avatar
              name={student.name}
              url={student.avatarUrl}
              className={`shrink-0 ${tv ? "size-11" : "size-9"}`}
            />
            <div className="min-w-0 flex-1">
              <h3 className={`truncate font-bold leading-tight dark:text-white ${tv ? "text-xl" : "text-sm"}`}>
                {student.name}
              </h3>
              <p className={`truncate text-gray-500 dark:text-gray-400 ${tv ? "text-sm" : "text-xs"}`}>
                {student.group}
              </p>
            </div>
            <div className="shrink-0 text-center">
              <p
                className={`font-black leading-none text-emerald-500 dark:text-emerald-400 ${
                  tv ? "text-2xl" : "text-lg"
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
        {podium(tv)}
        {rankGrid(tv ? restOfStudents.slice(0, TV_REST_LIMIT) : restOfStudents, tv)}
      </>
    );

  /*
   * طبقة ثابتة فوق كل شيء (فوق شريط التنقّل العلوي والسفلي) بدل تعديل MainLayout.
   * صنف `dark` عليها يفعّل أصناف dark: لما بداخلها — شاشة العرض داكنة دائماً.
   */
  const tvOverlay = createPortal(
    <div
      className="dark fixed inset-0 z-100 flex flex-col gap-4 overflow-hidden p-4 text-right font-['Cairo'] lg:gap-6 lg:p-6
        bg-[radial-gradient(ellipse_at_top,#064e3b_0%,#0b1220_55%,#05080f_100%)]"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 motion-reduce:animate-none">
        <div className="flex items-center gap-3">
          <FaTrophy className="text-3xl text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" />
          <h1 className="text-3xl font-black text-white lg:text-4xl">{t("leaderboard.title")}</h1>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-base font-bold text-emerald-300 ring-1 ring-emerald-400/40">
            {label}
          </span>
          {scopeName && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-base font-bold text-gray-200">
              {scopeName}
            </span>
          )}
        </div>
        <button
          onClick={exitTv}
          title={t("leaderboard.tv.exit")}
          aria-label={t("leaderboard.tv.exit")}
          className="rounded-xl bg-white/5 p-2.5 text-gray-400 opacity-40 transition hover:bg-white/15 hover:text-white hover:opacity-100"
        >
          <Minimize2 className="size-5" />
        </button>
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
          {/* فلترة بالحلقة — للمشرف فقط */}
          {current.showHalaqaPicker ? (
          <select
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-dark px-4 py-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <option value="">{t("leaderboard.filterHalaqa")}</option>
            {halaqat.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          ) : (
            <span className="rounded-xl bg-emerald-100 px-4 py-2 font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {current.halaqaName}
            </span>
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
