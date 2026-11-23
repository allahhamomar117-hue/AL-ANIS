import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, ChevronDown, Flag, RefreshCw, Trophy, X } from "lucide-react";
import { useParams } from "react-router-dom";
import {
  badgesService,
  tribeLogsService,
  tribesService,
} from "@/services/tribesService";
import type { Badge } from "@/types/tribes";

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

  return (
    <main
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-dvh bg-[#0a0e11] text-white"
    >
      <div className="mx-auto max-w-xl px-4 pb-10 pt-7 sm:px-6">
        <header className="mb-6 border-b border-white/10 pb-5">
          <p className="flex items-center gap-2 text-xs font-black text-emerald-300">
            <Flag size={15} /> نظام القبائل
          </p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black">لوحة الترتيب</h1>
              <p className="mt-1 text-xs text-white/45">
                تحدٍّ يتغير مع كل راية.
              </p>
            </div>
            <button
              type="button"
              title="تحديث الآن"
              onClick={() => {
                void tribesQuery.refetch();
                void logsQuery.refetch();
                void badgesQuery.refetch();
              }}
              className="flex size-10 items-center justify-center rounded-md border border-white/10 text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        <section aria-label="ترتيب القبائل" className="space-y-2">
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
              <article
                key={tribe.id}
                className="flex items-center gap-3 rounded-md border border-white/10 bg-[#11171b] p-3"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-black ${index === 0 ? "bg-amber-300 text-black" : "bg-white/5 text-white/65"}`}
                >
                  {index === 0 ? (
                    <Trophy size={17} />
                  ) : (
                    numberFormat.format(index + 1)
                  )}
                </span>
                {tribe.bg_image_url ? (
                  <img
                    src={tribe.bg_image_url}
                    alt=""
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                ) : (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tribe.theme_color || "#34d399" }}
                  />
                )}
                <h2 className="min-w-0 flex-1 truncate text-sm font-bold">
                  {tribe.name}
                </h2>
                <div className="text-left">
                  <p
                    className="text-xl font-black tabular-nums"
                    style={{ color: tribe.theme_color || "#34d399" }}
                  >
                    {numberFormat.format(tribe.score)}
                  </p>
                  <p className="text-[9px] text-white/40">راية</p>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <Award size={17} className="text-amber-300" /> بنك الدروع
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {badges.map((badge) => (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setSelectedBadge(badge)}
                  className="flex min-w-0 items-center gap-3 rounded-md border border-amber-300/15 bg-[#11171b] p-3 text-right transition hover:border-amber-300/50 hover:bg-[#171e23] focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  {badge.icon_url ? (
                    <img
                      src={badge.icon_url}
                      alt=""
                      className="size-9 shrink-0 object-contain"
                    />
                  ) : (
                    <Award size={28} className="shrink-0 text-amber-300" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">
                      {badge.title}
                    </span>
                    <span className="mt-1 block text-[10px] text-amber-200/70">
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
