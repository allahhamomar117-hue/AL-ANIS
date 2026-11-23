import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, ChevronDown, Crown, Flag, RefreshCw, Shield, X } from "lucide-react";
import { useParams } from "react-router-dom";
import {
  badgesService,
  tribeLogsService,
  tribesService,
} from "@/services/tribesService";
import type { Badge, Tribe } from "@/types/tribes";

const numberFormat = new Intl.NumberFormat("ar");

export default function TribesMobile() {
  const { lang = "ar" } = useParams();
  const [feedOpen, setFeedOpen] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const tribesQuery = useQuery({
    queryKey: ["tribes-public", "tribes"],
    queryFn: () => tribesService.list(),
    refetchInterval: 10_000,
  });
  const logsQuery = useQuery({
    queryKey: ["tribes-public", "logs"],
    queryFn: () => tribeLogsService.list(),
    refetchInterval: 8_000,
  });
  const badgesQuery = useQuery({
    queryKey: ["tribes-public", "badges"],
    queryFn: () => badgesService.list(),
    refetchInterval: 30_000,
  });

  const tribes = [...(tribesQuery.data ?? [])].sort(
    (first, second) => second.score - first.score,
  );
  const logs = logsQuery.data ?? [];
  const badges = badgesQuery.data ?? [];
  const leadingScore = tribes[0]?.score ?? 0;

  return (
    <main
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-dvh bg-[#080b0f] text-white"
    >
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
        <header className="relative mb-7 overflow-hidden rounded-xl border border-white/10 bg-[#0f141a] px-5 py-5 sm:px-6">
          <span className="absolute inset-y-4 right-0 w-0.75 rounded-full bg-linear-to-b from-emerald-300 via-cyan-400 to-amber-300" />
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-black tracking-[0.16em] text-emerald-300 sm:text-xs">
                <Flag size={14} /> ساحة التحدي
              </p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">لوحة القبائل</h1>
              <p className="mt-1 text-xs text-white/45 sm:text-sm">
                كل راية تقرّب قبيلتك من القمة.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden text-left sm:block">
                <p className="text-[10px] font-bold text-white/40">القبائل المتنافسة</p>
                <p className="mt-1 text-xl font-black tabular-nums">{numberFormat.format(tribes.length)}</p>
              </div>
            <button
              type="button"
              title="تحديث الآن"
              onClick={() => {
                void tribesQuery.refetch();
                void logsQuery.refetch();
                void badgesQuery.refetch();
              }}
              className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-white/3 text-white/65 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-emerald-200 active:scale-95"
            >
              <RefreshCw size={17} />
            </button>
            </div>
          </div>
        </header>

        <section aria-label="ترتيب القبائل" className="space-y-3">
          {tribesQuery.isPending ? (
            <p className="py-8 text-center text-sm text-white/50">
              جارٍ تحميل الترتيب...
            </p>
          ) : tribesQuery.isError ? (
            <InlineError
              message="تعذر تحميل القبائل."
              onRetry={() => void tribesQuery.refetch()}
            />
          ) : tribes.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/50">
              لا توجد قبائل لعرضها بعد.
            </p>
          ) : (
            tribes.map((tribe, index) => (
              <TribeRankCard
                key={tribe.id}
                tribe={tribe}
                rank={index + 1}
                leadingScore={leadingScore}
              />
            ))
          )}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black sm:text-base">
              <Shield size={17} className="text-amber-300" /> بنك الدروع
            </h2>
            <span className="text-[10px] text-white/40">
              اضغط لمعرفة طريقة الحصول
            </span>
          </div>
          {badgesQuery.isPending ? (
            <p className="py-5 text-center text-xs text-white/50">
              جارٍ تحميل الدروع...
            </p>
          ) : badgesQuery.isError ? (
            <InlineError
              message="تعذر تحميل الدروع."
              onRetry={() => void badgesQuery.refetch()}
            />
          ) : badges.length === 0 ? (
            <p className="rounded-md border border-white/10 bg-[#11171b] px-4 py-5 text-center text-xs text-white/50">
              لا توجد دروع متاحة بعد.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {badges.map((badge) => (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setSelectedBadge(badge)}
                  className="flex min-h-19 min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/3 p-3 text-right transition hover:border-amber-300/35 hover:bg-white/6 active:scale-95 focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-amber-200/10 bg-amber-300/6">
                    {badge.icon_url ? (
                      <img
                        src={badge.icon_url}
                        alt=""
                        className="size-8 object-contain"
                      />
                    ) : (
                      <Award size={24} className="text-amber-300" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs font-bold leading-5 sm:text-sm">
                      {badge.title}
                    </span>
                    <span className="mt-1 block text-[10px] text-amber-200/70 sm:text-[11px]">
                      {numberFormat.format(badge.required_flags)} راية
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-7 overflow-hidden rounded-md border border-white/10 bg-[#11171b]">
          <button
            type="button"
            aria-expanded={feedOpen}
            onClick={() => setFeedOpen((open) => !open)}
            className="flex w-full items-center justify-between px-4 py-4 text-right"
          >
            <span>
              <span className="block text-sm font-black">آخر الأحداث</span>
              <span className="mt-1 block text-[10px] text-white/45">
                إضافات الرايات إلى القبائل
              </span>
            </span>
            <span className="flex items-center gap-2 text-xs text-white/50">
              {logs.length}
              <ChevronDown
                size={17}
                className={`transition-transform ${feedOpen ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          {feedOpen && (
            <div className="border-t border-white/10">
              {logsQuery.isPending ? (
                <p className="px-4 py-6 text-center text-xs text-white/50">
                  جارٍ تحميل الأحداث...
                </p>
              ) : logsQuery.isError ? (
                <InlineError
                  message="تعذر تحميل سجل الأحداث."
                  onRetry={() => void logsQuery.refetch()}
                />
              ) : logs.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-white/50">
                  لم تسجّل أحداث بعد.
                </p>
              ) : (
                <ol className="max-h-[45dvh] divide-y divide-white/5 overflow-y-auto">
                  {logs.map((log) => (
                    <li key={log.id} className="flex gap-3 px-4 py-3">
                      <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                        <Flag size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-5 text-white/85">
                          <span className="font-bold text-white">
                            {log.student_name}
                          </span>
                          {" أضاف "}
                          <strong className="font-black text-amber-300">
                            {numberFormat.format(log.flags_added)} رايات
                          </strong>
                          {" إلى فريق قبيلته"}
                        </p>
                        {log.reason && (
                          <p className="mt-1 truncate text-[10px] text-white/45">
                            {log.reason}
                          </p>
                        )}
                        <time
                          className="mt-1 block text-[9px] text-white/35"
                          dir="auto"
                        >
                          {new Date(log.created_at).toLocaleString(
                            lang === "en" ? "en-US" : "ar-SA",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                            },
                          )}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>
      </div>

      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tribe-badge-title"
            className="relative w-full max-w-sm rounded-lg border border-amber-300/25 bg-[#11171b] p-5 text-white shadow-2xl shadow-black/50"
          >
            <button
              type="button"
              aria-label="إغلاق تفاصيل الدرع"
              onClick={() => setSelectedBadge(null)}
              className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X size={19} />
            </button>
            <div className="flex flex-col items-center pt-3 text-center">
              {selectedBadge.icon_url ? (
                <img
                  src={selectedBadge.icon_url}
                  alt=""
                  className="mb-4 size-20 object-contain"
                />
              ) : (
                <Award size={64} className="mb-4 text-amber-300" />
              )}
              <h2 id="tribe-badge-title" className="text-xl font-black">
                {selectedBadge.title}
              </h2>
              <p className="mt-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">
                {numberFormat.format(selectedBadge.required_flags)} راية مطلوبة
              </p>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <h3 className="text-xs font-bold text-white/55">
                كيفية الحصول عليه
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-white/85">
                {selectedBadge.description?.trim() ||
                  "لم تتم إضافة شرح لهذا الدرع بعد."}
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function TribeRankCard({
  tribe,
  rank,
  leadingScore,
}: {
  tribe: Tribe;
  rank: number;
  leadingScore: number;
}) {
  const accent = tribe.theme_color || "#34d399";
  const progress =
    leadingScore > 0
      ? Math.min(100, Math.max(0, (tribe.score / leadingScore) * 100))
      : 0;
  const isLeader = rank === 1;

  return (
    <article
      className={`relative isolate overflow-hidden rounded-xl border p-3.5 transition-colors ${
        isLeader ? "shadow-[0_0_30px_rgba(245,158,11,0.12)]" : ""
      }`}
      style={{
        backgroundImage: `linear-gradient(110deg, color-mix(in srgb, ${accent} 12%, #11171b), #11171b 64%, color-mix(in srgb, ${accent} 7%, #11171b))`,
        borderColor: isLeader
          ? "rgba(251, 191, 36, 0.38)"
          : `color-mix(in srgb, ${accent} 24%, rgba(255, 255, 255, 0.1))`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-3 right-0 w-0.75 rounded-full"
        style={{
          backgroundColor: accent,
          boxShadow: `0 0 16px ${accent}`,
        }}
      />
      <div className="flex items-center gap-3 pr-2">
        <RankMedal rank={rank} />
        <span
          className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
            borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`,
          }}
        >
          {tribe.bg_image_url ? (
            <img
              src={tribe.bg_image_url}
              alt=""
              className="size-8 object-contain"
            />
          ) : (
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: accent, boxShadow: `0 0 12px ${accent}` }}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="max-w-full truncate text-sm font-black sm:text-base">
              {tribe.name}
            </h2>
            {isLeader && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold text-amber-200">
                <Crown size={11} /> المتصدر
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-white/40">
            {isLeader ? "يحافظ على القمة" : `المركز ${numberFormat.format(rank)}`}
          </p>
        </div>
        <div className="shrink-0 text-left">
          <p
            className="text-2xl font-black leading-none tabular-nums sm:text-3xl"
            style={{ color: accent, textShadow: `0 0 18px ${accent}55` }}
          >
            {numberFormat.format(tribe.score)}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-white/45">راية</p>
        </div>
      </div>
      <div
        className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-label={`تقدم ${tribe.name} مقارنة بالمتصدر`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <span
          className="block h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${progress}%`,
            backgroundColor: accent,
            boxShadow: `0 0 12px ${accent}`,
          }}
        />
      </div>
    </article>
  );
}

function RankMedal({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? {
          frame: "from-amber-200 via-amber-400/80 to-yellow-700",
          surface: "bg-amber-500/15 text-amber-300",
        }
      : rank === 2
        ? {
            frame: "from-slate-100 via-slate-300/80 to-slate-500",
            surface: "bg-slate-300/10 text-slate-300",
          }
        : rank === 3
          ? {
              frame: "from-orange-200 via-orange-400/80 to-orange-700",
              surface: "bg-orange-400/10 text-orange-300",
            }
          : {
              frame: "from-slate-500/70 via-slate-600/50 to-slate-800",
              surface: "bg-slate-800/80 text-slate-400",
            };
  const shieldShape = {
    clipPath: "polygon(50% 0%, 96% 17%, 91% 72%, 50% 100%, 9% 72%, 4% 17%)",
  };

  return (
    <span
      className={`grid size-11 shrink-0 bg-linear-to-br p-px ${tone.frame} ${rank === 1 ? "drop-shadow-[0_0_10px_rgba(251,191,36,0.22)]" : ""}`}
      style={shieldShape}
      aria-label={`المركز ${numberFormat.format(rank)}`}
    >
      <span
        className={`grid size-full place-items-center ${tone.surface}`}
        style={shieldShape}
      >
        {rank === 1 ? (
          <Crown size={18} strokeWidth={2.2} />
        ) : (
          <span className="text-sm font-black tabular-nums">
            {numberFormat.format(rank)}
          </span>
        )}
      </span>
    </span>
  );
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-4 py-5 text-center">
      <p role="alert" className="text-xs text-rose-300">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-[11px] font-bold text-emerald-300 underline"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
