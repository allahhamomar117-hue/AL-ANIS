import { useQuery } from "@tanstack/react-query";
import { Award, Crown, Flag, Radio } from "lucide-react";
import { useParams } from "react-router-dom";
import { badgesService, tribesService } from "@/services/tribesService";
import type { Tribe } from "@/types/tribes";

const numberFormat = new Intl.NumberFormat("ar");

export default function TribesTV() {
  const { lang = "ar" } = useParams();
  const tribesQuery = useQuery({
    queryKey: ["tribes-public", "tribes"],
    queryFn: () => tribesService.list(),
    refetchInterval: 5_000,
  });
  const badgesQuery = useQuery({
    queryKey: ["tribes-public", "badges"],
    queryFn: () => badgesService.list(),
    refetchInterval: 30_000,
  });

  const tribes = [...(tribesQuery.data ?? [])].sort(
    (first, second) => second.score - first.score,
  );
  const rankedTribes = tribes.slice(0, 4);
  const leadingScore = rankedTribes[0]?.score ?? 0;
  const badges = (badgesQuery.data ?? []).slice(0, 8);

  return (
    <main
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#07090d] text-white"
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-[#0a0e13] px-6 py-3 md:px-10 md:py-4">
        <div className="flex items-center gap-4">
          <span className="grid size-11 place-items-center rounded-lg border border-emerald-300/20 bg-emerald-300/5 text-emerald-200">
            <Flag size={21} />
          </span>
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 md:text-xs">
              ساحة التحدي
            </p>
            <h1 className="mt-1 text-xl font-black md:text-3xl">
              معركة القبائل
            </h1>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/8 px-4 py-2 text-xs font-bold text-rose-200 md:text-sm">
          <Radio size={15} className="animate-pulse" /> بث مباشر
        </span>
      </header>

      <section className="min-h-0 px-4 py-4 md:px-7 md:py-5 2xl:px-10">
        {tribesQuery.isPending ? (
          <PublicState label="جارٍ تحميل ترتيب القبائل..." />
        ) : tribesQuery.isError ? (
          <PublicError onRetry={() => void tribesQuery.refetch()} />
        ) : rankedTribes.length === 0 ? (
          <PublicState label="لا توجد قبائل لعرضها بعد." />
        ) : (
          <div className="grid h-full min-h-0 grid-cols-4 gap-3 md:gap-5 2xl:gap-7">
            {rankedTribes.map((tribe, index) => (
              <TribeCard
                key={tribe.id}
                tribe={tribe}
                rank={index + 1}
                leadingScore={leadingScore}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="max-h-[36vh] overflow-hidden border-t border-amber-300/15 bg-[#0b0f14] px-5 py-3 md:px-8 md:py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-200">
            <Award size={19} />
            <h2 className="text-sm font-black md:text-base">
              بنك الدروع المتاحة
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-white/35 md:text-xs">
            أهداف القبائل
          </span>
          {badgesQuery.isError && (
            <span className="text-[10px] text-rose-300">تعذر تحميل الدروع</span>
          )}
        </div>
        {badges.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/45">
            لا توجد دروع مضافة بعد.
          </p>
        ) : (
          <div className="grid grid-cols-4 grid-rows-2 gap-2.5 md:gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/4 p-2.5 md:min-h-20 md:p-3"
              >
                {badge.icon_url ? (
                  <img
                    src={badge.icon_url}
                    alt=""
                    className="size-9 shrink-0 object-contain md:size-11"
                  />
                ) : (
                  <Award className="size-8 shrink-0 text-amber-300 md:size-10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="wrap-break-word text-xs font-bold leading-5 md:text-sm">
                    {badge.title}
                  </p>
                  <p className="mt-1 text-xs font-black text-amber-200 md:text-sm">
                    {numberFormat.format(badge.required_flags)} راية
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </footer>
    </main>
  );
}

function TribeCard({
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
      className={`relative isolate flex min-w-0 flex-col overflow-hidden rounded-xl border bg-[#10151b] p-4 md:p-5 2xl:p-7 ${
        isLeader ? "shadow-[0_0_34px_rgba(251,191,36,0.12)]" : ""
      }`}
      style={{
        borderColor: isLeader
          ? "rgba(251, 191, 36, 0.48)"
          : `color-mix(in srgb, ${accent} 40%, rgba(255,255,255,0.1))`,
      }}
    >
      {tribe.bg_image_url && (
        <img
          src={tribe.bg_image_url}
          alt=""
          className="absolute inset-0 z-0 size-full object-cover opacity-45"
        />
      )}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 38%, ${accent}24 0%, transparent 58%), linear-gradient(to bottom, ${accent}10 0%, rgba(5,8,12,0.38) 42%, rgba(5,8,12,0.94) 100%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-1"
        style={{
          backgroundColor: isLeader ? "#fbbf24" : accent,
          boxShadow: `0 0 18px ${isLeader ? "#fbbf24" : accent}`,
        }}
      />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <RankBadge rank={rank} />
        <span
          className="mt-1 size-3 rounded-full ring-4 ring-white/10 md:size-4"
          style={{ backgroundColor: accent, boxShadow: `0 0 16px ${accent}` }}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center py-4 text-center">
        <h2 className="max-w-full wrap-break-word text-2xl font-black md:text-3xl 2xl:text-5xl">
          {tribe.name}
        </h2>
        <p className="mt-3 text-xs font-bold tracking-[0.22em] text-white/55 md:text-sm">
          الرايات
        </p>
        <p
          className="mt-2 max-w-full break-all text-7xl font-black leading-none tabular-nums md:text-8xl 2xl:text-[10rem]"
          style={{
            color: accent,
            filter: `drop-shadow(0 0 14px ${accent}60)`,
            textShadow: `0 0 18px ${accent}80, 0 0 42px ${accent}35`,
          }}
        >
          {numberFormat.format(tribe.score)}
        </p>
      </div>

      <div className="relative z-10 mt-auto">
        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold text-white/45 md:text-xs">
          <span>التقدم نحو الصدارة</span>
          <span className="tabular-nums">
            {numberFormat.format(Math.round(progress))}٪
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 md:h-2"
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
              boxShadow: `0 0 14px ${accent}`,
            }}
          />
        </div>
      </div>
    </article>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? {
          rim: "from-amber-200 via-amber-400 to-yellow-700",
          surface: "border-amber-400/50 bg-amber-500/15 text-amber-200",
        }
      : rank === 2
        ? {
            rim: "from-slate-100 via-slate-300 to-slate-500",
            surface: "border-slate-300/40 bg-slate-300/10 text-slate-200",
          }
        : rank === 3
          ? {
              rim: "from-orange-200 via-orange-400 to-orange-700",
              surface: "border-orange-400/40 bg-orange-400/10 text-orange-200",
            }
          : {
              rim: "from-slate-500 via-slate-600 to-slate-800",
              surface: "border-slate-500/30 bg-slate-800/80 text-slate-300",
            };

  return (
    <span
      className={`inline-flex rounded-full bg-linear-to-br p-px ${tone.rim} ${
        rank === 1 ? "drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]" : ""
      }`}
      aria-label={rank === 1 ? "المتصدر، المركز الأول" : `المركز ${rank}`}
    >
      <span
        className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-xs font-black md:text-sm ${tone.surface}`}
      >
        {rank === 1 ? (
          <>
            <Crown size={16} className="text-amber-300" />
            <span>المتصدر #1</span>
          </>
        ) : (
          <span>#{numberFormat.format(rank)}</span>
        )}
      </span>
    </span>
  );
}

function PublicState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm font-semibold text-white/55">
      {label}
    </div>
  );
}

function PublicError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-bold text-rose-300">
        تعذر تحميل بيانات القبائل.
      </p>
      <button
        onClick={onRetry}
        className="rounded border border-white/20 px-4 py-2 text-xs font-bold hover:bg-white/10"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
