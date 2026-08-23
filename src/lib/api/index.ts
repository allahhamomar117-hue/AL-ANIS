/**
 * دوال جاهزة لكل نقاط API، مرتّبة حسب الميزة.
 * مثال: const { data } = await halaqatApi.list();
 */
import { api, setToken } from "./client";
import type {
  AttendanceSession,
  AttendanceSheet,
  AttendanceStatus,
  AuthUser,
  DailyReport,
  DashboardStats,
  Halaqa,
  HalaqaStage,
  HalaqaStudent,
  LeaderboardRow,
  Paged,
  PointTransaction,
  Rating,
  Recitation,
  RecitationType,
  Role,
  StaffUser,
  Student,
  StudentStats,
} from "./types";

export * from "./types";
export { api, ApiError, getToken, setToken } from "./client";

/* ==================== الدخول ==================== */

export const authApi = {
  /** تسجيل الدخول باسم المستخدم وكلمة المرور. */
  login: async (username: string, password: string) => {
    const result = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
      username,
      password,
    });
    setToken(result.token);
    return result;
  },

  requestOtp: (phone_number: string, country_code = "963") =>
    api.post<{ message: string; expires_in_minutes: number; dev_code?: string }>(
      "/auth/request-otp",
      { phone_number, country_code }
    ),

  verifyOtp: async (params: {
    phone_number: string;
    otp: string;
    country_code?: string;
    fcm_token?: string;
  }) => {
    const result = await api.post<{ token: string; user: AuthUser }>("/auth/verify-otp", {
      country_code: "963",
      ...params,
    });
    setToken(result.token);
    return result;
  },

  me: () => api.get<{ user: AuthUser }>("/auth/me"),

  logout: () => setToken(null),
};

/* ==================== الحلقات ==================== */

export const halaqatApi = {
  list: (params?: { mine?: boolean; active?: boolean }) =>
    api.get<{ data: Halaqa[] }>("/halaqat", params),
  get: (id: number) => api.get<{ data: Halaqa }>(`/halaqat/${id}`),
  students: (id: number) => api.get<{ data: HalaqaStudent[] }>(`/halaqat/${id}/students`),
  create: (body: {
    name: string;
    teacher_id?: number | null;
    stage?: HalaqaStage | null;
    schedule_time?: string | null;
    location?: string | null;
  }) => api.post<{ data: Halaqa }>("/halaqat", body),
  update: (
    id: number,
    body: Partial<{
      name: string;
      teacher_id: number | null;
      stage: HalaqaStage | null;
      schedule_time: string | null;
      location: string | null;
      is_active: boolean;
    }>
  ) =>
    api.patch<{ data: Halaqa }>(`/halaqat/${id}`, body),
  /** تعطيل الحلقة. reassignTo تنقل طلابها إلى حلقة أخرى (يطلبها الخادم إن كان فيها طلاب). */
  remove: (id: number, params?: { reassignTo?: number }) =>
    api.delete<void>(`/halaqat/${id}`, params),
};

/* ==================== الطلاب والنقاط ==================== */

export const studentsApi = {
  list: (params?: { halaqaId?: number; search?: string; limit?: number; offset?: number }) =>
    api.get<Paged<Student>>("/students", params),

  get: (id: number) => api.get<{ data: Student; stats: StudentStats }>(`/students/${id}`),

  create: (body: {
    name: string;
    code?: string;
    halaqa_id?: number | null;
    birth_date?: string | null;
    student_phone?: string | null;
    parent_phone?: string | null;
  }) => api.post<{ data: Student }>("/students", body),

  update: (id: number, body: Partial<{ name: string; halaqa_id: number | null; birth_date: string | null; student_phone: string | null; parent_phone: string | null; is_active: boolean }>) =>
    api.patch<{ data: Student }>(`/students/${id}`, body),

  remove: (id: number, hard = false) =>
    api.delete<void>(`/students/${id}`, hard ? { hard: true } : undefined),

  /** رفع صورة الطالب (data URL بعد تصغيرها في المتصفح). */
  uploadAvatar: (id: number, data: string) =>
    api.post<{ data: Student }>(`/students/${id}/avatar`, { data }),

  /** إزالة الصورة والعودة إلى الحرفين الأولين. */
  removeAvatar: (id: number) => api.delete<{ data: Student }>(`/students/${id}/avatar`),

  transfer: (id: number, halaqa_id: number) =>
    api.post<{ data: Student }>(`/students/${id}/transfer`, { halaqa_id }),

  points: (id: number, params?: { limit?: number; offset?: number }) =>
    api.get<{ data: PointTransaction[]; meta: { balance: number } }>(
      `/students/${id}/points`,
      params
    ),

  addPoints: (id: number, amount: number, reason?: string) =>
    api.post<{ data: { id: number; delta: number; balance: number } }>(`/students/${id}/points`, {
      amount,
      operation: "add",
      reason,
    }),

  deductPoints: (id: number, amount: number, reason?: string) =>
    api.post<{ data: { id: number; delta: number; balance: number } }>(`/students/${id}/points`, {
      amount,
      operation: "deduct",
      reason,
    }),
};

/* ==================== الحضور ==================== */

export const attendanceApi = {
  /** يجهّز شاشة التسجيل: طلاب الحلقة مع حالتهم في التاريخ المحدد. */
  sheet: (halaqaId: number, date?: string) =>
    api.get<{ data: AttendanceSheet }>(`/attendance/halaqat/${halaqaId}`, { date }),

  /** حفظ حضور حلقة في يوم — آمن للتكرار (يحدّث نفس الجلسة). */
  save: (body: {
    halaqaId: number;
    date?: string;
    teacherStatus?: "present" | "absent";
    notes?: string | null;
    students: { id: number; status: AttendanceStatus }[];
  }) => api.post<{ data: AttendanceSession }>("/attendance", body),

  sessions: (params?: {
    halaqaId?: number;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => api.get<{ data: AttendanceSession[] }>("/attendance/sessions", params),

  session: (id: number) => api.get<{ data: AttendanceSession }>(`/attendance/sessions/${id}`),

  setStatus: (sessionId: number, studentId: number, status: AttendanceStatus) =>
    api.patch<{ data: AttendanceSession["students"] }>(
      `/attendance/sessions/${sessionId}/students/${studentId}`,
      { status }
    ),

  removeStudent: (sessionId: number, studentId: number) =>
    api.delete<void>(`/attendance/sessions/${sessionId}/students/${studentId}`),

  removeSession: (sessionId: number) => api.delete<void>(`/attendance/sessions/${sessionId}`),
};

/* ==================== التلاوة والتسميع ==================== */

export const recitationsApi = {
  list: (params?: {
    studentId?: number;
    halaqaId?: number;
    from?: string;
    to?: string;
    rating?: Rating;
    limit?: number;
    offset?: number;
  }) => api.get<Paged<Recitation>>("/recitations", params),

  get: (id: number) => api.get<{ data: Recitation }>(`/recitations/${id}`),

  create: (body: {
    studentId: number;
    halaqaId?: number;
    type: RecitationType;
    /** بديل عن pageNumber: الخادم يشتقّ الصفحات ووزن النقاط من السورة. */
    surahNumber?: number | null;
    pageNumber?: number;
    toPage?: number | null;
    verse?: number | null;
    pageCompleted?: boolean;
    rating: Rating;
    notes?: string | null;
    recitedAt?: string;
  }) => api.post<{ data: Recitation }>("/recitations", body),

  update: (id: number, body: Partial<{ type: RecitationType; pageNumber: number; toPage: number | null; verse: number | null; pageCompleted: boolean; rating: Rating; notes: string | null; recitedAt: string }>) =>
    api.patch<{ data: Recitation }>(`/recitations/${id}`, body),

  remove: (id: number) => api.delete<void>(`/recitations/${id}`),
};

/* ==================== التقارير ==================== */

export const reportsApi = {
  leaderboard: (params?: {
    type?: "points" | "attendance" | "recitation";
    halaqaId?: number;
    from?: string;
    to?: string;
    limit?: number;
  }) =>
    api.get<{ data: LeaderboardRow[]; meta: { type: string; from: string | null; to: string | null } }>(
      "/reports/leaderboard",
      params
    ),

  dashboard: (date?: string) => api.get<{ data: DashboardStats }>("/reports/dashboard", { date }),

  /** تقرير اليوم لحلقة: حضور وتسميع ونقاط كل طالب — مصدر ملخّص الأهالي. */
  dailyHalaqa: (id: number, date?: string) =>
    api.get<{ data: DailyReport }>(`/reports/halaqat/${id}/daily`, { date }),

  halaqa: (id: number, params?: { from?: string; to?: string }) =>
    api.get<{ data: unknown }>(`/reports/halaqat/${id}`, params),

  student: (id: number, params?: { from?: string; to?: string }) =>
    api.get<{ data: unknown }>(`/reports/students/${id}`, params),
};

/* ==================== المستخدمون ==================== */

export const usersApi = {
  /** دليل الكادر — للمدير وحده (الخادم يرد 403 لغيره). */
  list: (params?: { role?: Role; includeInactive?: boolean }) =>
    api.get<{ data: StaffUser[] }>("/users", params),

  create: (body: {
    name: string;
    username: string;
    password: string;
    role?: Role;
    halaqaIds?: number[];
  }) => api.post<{ data: StaffUser }>("/users", body),

  update: (
    id: number,
    body: Partial<{
      name: string;
      username: string;
      password: string;
      role: Role;
      is_active: boolean;
      halaqaIds: number[];
    }>
  ) => api.patch<{ data: StaffUser }>(`/users/${id}`, body),

  /**
   * تعيين كلمة مرور جديدة — مسار مستقل محصور بالمدير، حدّه الأدنى ثمانية أحرف.
   */
  setPassword: (id: number, password: string) =>
    api.put<{ data: StaffUser }>(`/users/${id}/password`, { password }),

  /** تعطيل الحساب — لا حذف فعلي حفاظاً على السجلات المرتبطة. */
  deactivate: (id: number) => api.delete<{ data: StaffUser }>(`/users/${id}`),

  /** الحلقات المسندة إلى مستخدم. */
  halaqat: (id: number) =>
    api.get<{ data: { id: number; name: string; isPrimary: number }[] }>(`/users/${id}/halaqat`),

  /** استبدال كامل لقائمة الحلقات المسندة. */
  assignHalaqat: (id: number, halaqaIds: number[]) =>
    api.put<{ data: { id: number; name: string }[] }>(`/users/${id}/halaqat`, { halaqaIds }),
};
