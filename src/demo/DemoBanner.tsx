import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Monitor, RotateCcw, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  exitDemoMode,
  getDemoSnapshot,
  resetDemoData,
  setDemoRole,
  subscribeDemoStore,
  type DemoRole,
} from "./demoStore";

const roles: DemoRole[] = ["ADMIN", "TEACHER", "SUPERVISOR"];

export default function DemoBanner() {
  const demo = useSyncExternalStore(
    subscribeDemoStore,
    getDemoSnapshot,
    getDemoSnapshot,
  );
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { lang = "ar" } = useParams();
  const queryClient = useQueryClient();

  if (!demo.isDemoMode) return null;

  const switchRole = (role: DemoRole) => {
    setDemoRole(role);
    queryClient.clear();
    navigate(`/${lang}`);
  };

  const openTv = () => {
    setDemoRole("ADMIN");
    queryClient.clear();
    navigate(`/${lang}/reports?tv=1`);
  };

  const reset = () => {
    resetDemoData();
    queryClient.invalidateQueries();
  };

  const exit = () => {
    exitDemoMode();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <aside
      dir={i18n.dir()}
      className="fixed inset-x-0 top-0 z-60 min-h-12 border-b border-amber-300/70 bg-amber-50/95 text-slate-800 shadow-sm backdrop-blur-md dark:border-amber-200/15 dark:bg-slate-950/95 dark:text-slate-100"
      aria-label={t("demo.bannerLabel")}
    >
      <div className="mx-auto flex min-h-12 max-w-screen-2xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 md:px-5">
        <p className="flex min-w-0 items-center gap-2 text-xs font-semibold md:text-sm">
          <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <span>{t("demo.notice")}</span>
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              aria-pressed={demo.demoRole === role}
              onClick={() => switchRole(role)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 md:text-sm ${
                demo.demoRole === role
                  ? "bg-emerald-700 text-white dark:bg-emerald-400 dark:text-slate-950"
                  : "bg-white/80 text-slate-700 hover:bg-white dark:bg-white/8 dark:text-slate-200 dark:hover:bg-white/15"
              }`}
            >
              {t(`roles.${role}`)}
            </button>
          ))}
          <button
            type="button"
            onClick={openTv}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white md:text-sm"
          >
            <Monitor className="size-3.5" />
            {t("demo.tv")}
          </button>
          <button
            type="button"
            onClick={reset}
            title={t("demo.reset")}
            aria-label={t("demo.reset")}
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-amber-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={exit}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300/80 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10 md:text-sm"
          >
            <ArrowLeft className="size-3.5" />
            {t("demo.exit")}
          </button>
        </div>
      </div>
    </aside>
  );
}
