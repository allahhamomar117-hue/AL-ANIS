import { createContext, use } from "react";
import type { AuthUser, Department, Role } from "../lib/api/types";

export interface AuthContextValue {
  /** المستخدم الحالي، أو null إن لم تكن هناك جلسة. */
  user: AuthUser | null;
  role: Role | null;
  /**
   * أقسام المستخدم، أو قائمة فارغة لمن نطاقه المعهد كلّه.
   *
   * تُقرأ من هنا لا من user.departments مباشرةً: المدرّس له أقسام أيضاً
   * (ليظهر في قائمة كادر قسمه) لكن نطاقه حلقاته لا أقسامه — فقراءتها
   * خاماً تُنتج قيداً لا وجود له على الخادم.
   */
  departments: Department[];
  /** مدير عام: إداريّ بلا أقسام — يرى الأقسام كلها ويسند الحسابات إليها. */
  isSuperAdmin: boolean;
  /** حلقة المدرّس الافتراضية؛ null للمدير والمشرف. */
  halaqaId: number | null;
  halaqaName: string | null;
  /** كل حلقات المستخدم (فارغة للمدير والمشرف لأنهما يريان الجميع). */
  halaqat: { id: number; name: string }[];
  /** صلاحية البيانات الموسّعة: المدير والمشرف سواء. */
  isAdmin: boolean;
  isTeacher: boolean;
  /** مشرف بلا إدارة حسابات. */
  isSupervisor: boolean;
  /** إدارة سجلّات الطلاب (CRUD) — المدير وحده، لا المشرف. */
  canManageStudents: boolean;
  /** إدارة حسابات الكادر — المدير وحده. */
  canManageUsers: boolean;
  isLoading: boolean;
  /** خطأ الجلسة — 401 يعني لا جلسة صالحة. */
  error: unknown;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refresh: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** الوصول إلى حالة المصادقة. يجب أن يكون داخل <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth يجب أن يُستخدم داخل AuthProvider");
  return context;
}
