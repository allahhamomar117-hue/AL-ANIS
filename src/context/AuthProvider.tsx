import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, authApi, getToken, setToken } from "../lib/api";
import { qk } from "../lib/api/queryKeys";
import { AuthContext, type AuthContextValue } from "./authContext";


/**
 * مزوّد حالة المصادقة: يقرأ الجلسة من /auth/me ويوفّر الدور والحلقة
 * لكل الصفحات، مع دالتَي دخول وخروج.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  /**
   * الرمز كحالة React ليكون تفاعلياً، وهو جزء من مفتاح الاستعلام:
   * تغيّره يبدأ استعلاماً جديداً، فلا يتسرّب خطأ 401 من جلسة سابقة
   * إلى الجلسة الجديدة (كان يسبب ارتداداً إلى /login بعد الدخول).
   */
  const [token, setTokenState] = useState<string | null>(() => getToken());

  const session = useQuery({
    queryKey: [...qk.auth.me, token],
    queryFn: async () => {
      const { user } = await authApi.me();
      return user;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const login = useCallback(
    async (username: string, password: string) => {
      // الترتيب مهم: نحصل على الرمز أولاً. تفريغ الذاكرة قبل ذلك يُطلق
      // إعادة جلب لـ /auth/me بلا رمز، فيفشل 401 ويُفسد الجلسة الجديدة.
      const { user } = await authApi.login(username, password);
      queryClient.clear();
      setTokenState(getToken());
      return user;
    },
    [queryClient]
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    localStorage.removeItem("canResend");
    queryClient.clear();
  }, [queryClient]);

  const user = session.data ?? null;
  const { isPending, isError, error, refetch } = session;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      halaqaId: user?.halaqa_id ?? null,
      halaqaName: user?.halaqa_name ?? null,
      halaqat: user?.halaqat ?? [],
      // المشرف يرى كل البيانات كالمدير (نطاق القراءة)؛ لكنه لا يدير
      // حسابات الكادر ولا سجلّات الطلاب — دوره تشغيلي يومي
      /*
       * القسم يخصّ الإداريين وحدهم — يطابق departmentScope على الخادم.
       * المدرّس يُعاد له null لأن نطاقه حلقاته المسندة لا قسمه.
       */
      department:
        user?.role === "ADMIN" || user?.role === "SUPERVISOR"
          ? user.department
          : null,
      isSuperAdmin:
        (user?.role === "ADMIN" || user?.role === "SUPERVISOR") &&
        user.department === null,
      isAdmin: user?.role === "ADMIN" || user?.role === "SUPERVISOR",
      isTeacher: user?.role === "TEACHER",
      isSupervisor: user?.role === "SUPERVISOR",
      canManageStudents: user?.role === "ADMIN",
      canManageUsers: user?.role === "ADMIN",
      isLoading: Boolean(token) && isPending,
      error: token ? (isError ? error : null) : new ApiError(401, "يجب تسجيل الدخول"),
      login,
      logout,
      refresh: () => void refetch(),
    }),
    [user, token, isPending, isError, error, refetch, login, logout]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
