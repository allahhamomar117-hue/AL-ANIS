import { useQuery } from "@tanstack/react-query";
import { Award, Flag, Radio } from "lucide-react";
import { useParams } from "react-router-dom";
import { badgesService, tribesService } from "@/services/tribesService";

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
  const badges = badgesQuery.data ?? [];

  return (
    <main
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#070a0d] text-white"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3 md:px-10 md:py-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 md:text-xs">
            <Flag size={14} /> ساحة التحدي
          </p>
          <h1 className="mt-1 text-xl font-black md:text-3xl">معركة القبائل</h1>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300">
          <Radio size={14} className="animate-pulse" /> مباشر
        </span>
      </header>

      <section className="min-h-0 px-3 py-3 md:px-7 md:py-5">
        {tribesQuery.isPending ? (
          <PublicState label="جارٍ تحميل ترتيب القبائل..." />
        ) : tribesQuery.isError ? (
          <PublicError onRetry={() => void tribesQuery.refetch()} />
        ) : tribes.length === 0 ? (
          <PublicState label="لا توجد قبائل لعرضها بعد." />
        ) : (
          <div
            className="grid h-full min-h-0 gap-2 md:gap-4"
            style={{
              gridTemplateColumns: `repeat(${tribes.length}, minmax(0, 1fr))`,
            }}
          >
            {tribes.map((tribe, index) => {
              const accent = tribe.theme_color || "#34d399";
              return (
                <article
                  key={tribe.id}
                  className="relative isolate flex min-w-0 flex-col justify-between overflow-hidden rounded-md border bg-[#11171b] p-3 md:p-6 2xl:p-9"
                  style={{
                    borderColor: `${accent}70`,
                    boxShadow: `inset 0 0 35px ${accent}14`,
                  }}
                >
                  {tribe.bg_image_url && (
                    <img
                      src={tribe.bg_image_url}
                      alt=""
                      className="absolute inset-0 -z-20 size-full object-cover opacity-65"
                    />
                  )}
                  <div className="absolute inset-0 -z-10 bg-linear-to-t from-black via-black/70 to-black/20" />
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-sm border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-bold text-white/75 md:text-xs">
                      <span className="text-amber-300">
                        #{numberFormat.format(index + 1)}
                      </span>
                      الترتيب
                    </span>
                    <span
                      className="size-3 rounded-full ring-4 ring-white/10 md:size-4"
                      style={{ backgroundColor: accent }}
                    />
                  </div>
                  <div className="min-w-0 text-center">
                    <h2 className="truncate text-lg font-black md:text-3xl 2xl:text-5xl">
                      {tribe.name}
                    </h2>
                    <p className="mt-1 text-[10px] font-bold tracking-widest text-white/55 md:text-sm">
                      الرايات
                    </p>
                    <p
                      className="mt-1 truncate text-6xl font-black leading-none tabular-nums md:text-8xl 2xl:text-[10rem]"
                      style={{
                        color: accent,
                        textShadow: `0 0 30px ${accent}80`,
                      }}
                    >
                      {numberFormat.format(tribe.score)}
                    </p>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full w-full"
                      style={{
                        backgroundColor: accent,
                        boxShadow: `0 0 14px ${accent}`,
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="max-h-[23vh] overflow-hidden border-t border-amber-300/20 bg-[#0c1115] px-4 py-2.5 md:px-8 md:py-3">
        <div className="mb-2 flex items-center gap-2 text-amber-300">
          <Award size={17} />
          <h2 className="text-xs font-black md:text-sm">بنك الدروع المتاحة</h2>
          {badgesQuery.isError && (
            <span className="text-[10px] text-rose-300">تعذر تحميل الدروع</span>
          )}
        </div>
        {badges.length === 0 ? (
          <p className="text-[11px] text-white/45">لا توجد دروع مضافة بعد.</p>
        ) : (
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${badges.length}, minmax(0, 1fr))`,
            }}
          >
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="flex min-w-0 items-center gap-2 border-e border-white/10 px-2 last:border-0 md:gap-3 md:px-4"
              >
                {badge.icon_url ? (
                  <img
                    src={badge.icon_url}
                    alt=""
                    className="size-7 shrink-0 object-contain md:size-10"
                  />
                ) : (
                  <Award className="size-6 shrink-0 text-amber-300 md:size-9" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold md:text-sm">
                    {badge.title}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] text-white/50 md:text-xs">
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
