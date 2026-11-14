import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Flag, RefreshCw, Trophy } from "lucide-react";
import { useParams } from "react-router-dom";
import { tribeLogsService, tribesService } from "@/services/tribesService";

const numberFormat = new Intl.NumberFormat("ar");

export default function TribesMobile() {
  const { lang = "ar" } = useParams();
  const [feedOpen, setFeedOpen] = useState(true);
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

  const tribes = [...(tribesQuery.data ?? [])].sort(
    (first, second) => second.score - first.score,
  );
  const logs = logsQuery.data ?? [];

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
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tribe.theme_color || "#34d399" }}
                />
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
