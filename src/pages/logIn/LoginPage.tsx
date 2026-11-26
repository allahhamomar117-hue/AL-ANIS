import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaLock, FaUser } from "react-icons/fa";
import { Globe2, Play } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/authContext";
import { ApiError } from "../../lib/api";
import { activateDemoMode } from "../../demo/demoStore";
import logo from "../../assets/logo.png";

/** تسجيل الدخول باسم المستخدم وكلمة المرور. */
export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  /** المسار الذي حاول المستخدم فتحه قبل التحويل إلى صفحة الدخول. */
  const from = (location.state as { from?: string } | null)?.from;
  const nextLanguage = i18n.language.startsWith("ar") ? "en" : "ar";
  const nextLanguageLabel = nextLanguage === "en" ? "EN" : "عربي";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError(t("login.missingFields"));
      return;
    }

    setPending(true);
    setError("");

    try {
      await login(username.trim(), password);
      navigate(from && from !== "/login" ? from : "/ar", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.failed"));
    } finally {
      setPending(false);
    }
  };

  const enterDemo = () => {
    queryClient.clear();
    activateDemoMode("ADMIN");
    navigate(`/${i18n.language === "en" ? "en" : "ar"}`, { replace: true });
  };

  const switchLanguage = () => {
    void i18n.changeLanguage(nextLanguage);
    navigate(`/${nextLanguage}/login`, {
      replace: true,
      state: location.state,
    });
  };

  const fieldClass =
    "w-full rounded-xl border border-gray-300 py-3 ps-11 pe-4 text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400";

  return (
    <div
      className="app-bg relative flex min-h-screen flex-col bg-emerald-50"
      dir={i18n.dir()}
    >
      <button
        type="button"
        onClick={switchLanguage}
        aria-label={t("login.switchLanguage")}
        title={t("login.switchLanguage")}
        className="absolute end-4 top-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-white/75 px-3 text-xs font-bold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        <Globe2 className="size-4" />
        {nextLanguageLabel}
      </button>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-6 shadow-xl">
          {/* الشعار: ارتفاع ثابت والعرض يتبع النسبة — الشعار طولي لا مربّع */}
          <img
            src={logo}
            alt=""
            className="mx-auto h-24 w-auto object-contain"
          />

          <h1 className="text-center text-2xl font-bold text-gray-800">
            {t("login.title")}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* اسم المستخدم */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                {t("login.username")}
              </label>
              <div className="relative">
                <FaUser className="absolute top-1/2 -translate-y-1/2 start-4 text-gray-400" />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("login.usernamePlaceholder")}
                  className={fieldClass}
                />
              </div>
            </div>

            {/* كلمة المرور */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                {t("login.password")}
              </label>
              <div className="relative">
                <FaLock className="absolute top-1/2 -translate-y-1/2 start-4 text-gray-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••"
                  className={fieldClass}
                />
              </div>
            </div>

            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center rounded-xl bg-emerald-500 py-3 font-semibold
                text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {pending ? (
                <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                t("login.submit")
              )}
            </button>
          </form>

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">
              {t("demo.or")}
            </span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={enterDemo}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/70 py-3 font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Play className="size-4" />
            {t("demo.loginButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
