/** أنواع البيانات القادمة من API الأنيس. */

export type Role = "ADMIN" | "SUPERVISOR" | "TEACHER";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type RecitationType = "full" | "half" | "more" | "surah";
export type Rating = "excellent" | "good" | "needs";
export type PointKind = "manual" | "attendance" | "recitation" | "adjustment";

export interface AuthUser {
  id: number;
  name: string;
  username: string | null;
  /** اختياري: حسابات الكادر تُنشأ باسم مستخدم وكلمة مرور. */
  phone_number: string | null;
  country_code: string;
  role: Role;
  /** حلقة المدرّس الافتراضية — null للمدير والمشرف (يريان الجميع). */
  halaqa_id: number | null;
  halaqa_name: string | null;
  /** كل حلقات المستخدم؛ فارغة للمدير والمشرف. */
  halaqat: { id: number; name: string }[];
}

/** المرحلة الدراسية للحلقة — مفاتيح ثابتة، الترجمة في locales تحت halaqaStages. */
export const HALAQA_STAGES = ["primary", "preparatory", "secondary"] as const;
export type HalaqaStage = (typeof HALAQA_STAGES)[number];

export interface Halaqa {
  id: number;
  name: string;
  teacherId: number | null;
  teacher: string;
  stage: HalaqaStage | null;
  scheduleTime: string | null;
  location: string | null;
  isActive: number;
  students: number;
}

/**
 * طور الطالب — الترجمة في locales تحت studentStatuses.
 *
 * مستقلّ عن isActive: ذاك سجلٌّ أُلغي لخطأ إدخال، وهذا طالب أنهى دورته
 * وتبقى سجلاته التاريخية كاملة.
 */
export const STUDENT_STATUSES = ["active", "archived"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface Student {
  id: number;
  code: string;
  name: string;
  halaqaId: number | null;
  halaqa: string;
  birthDate: string | null;
  studentPhone: string | null;
  parentPhone: string | null;
  avatarUrl: string | null;
  points: number;
  status: StudentStatus;
  isActive: number;
  createdAt: string;
}

export interface HalaqaStudent {
  id: number;
  code: string;
  name: string;
  points: number;
  avatarUrl: string | null;
  lastRecitation: string | null;
  lastPage: number | null;
}

export interface StudentStats {
  attendance: { sessions: number; attended: number; rate: number };
  recitations: { total: number; excellent: number; lastDate: string | null };
}

export interface PointTransaction {
  id: number;
  delta: number;
  reason: string | null;
  kind: PointKind;
  referenceId: number | null;
  createdAt: string;
  createdBy: string;
}

export interface AttendanceEntry {
  id: number;
  studentId: number;
  name: string;
  code: string;
  avatarUrl: string | null;
  status: AttendanceStatus;
}

export interface AttendanceSession {
  id: number;
  halaqaId: number;
  halaqa: string;
  date: string;
  teacherStatus: "present" | "absent";
  notes: string | null;
  students: AttendanceEntry[];
}

export interface AttendanceSheet {
  halaqa: { id: number; name: string; teacher: string };
  date: string;
  sessionId: number | null;
  teacherStatus: "present" | "absent";
  notes: string | null;
  recorded: boolean;
  students: {
    id: number;
    code: string;
    name: string;
    avatarUrl: string | null;
    status: AttendanceStatus;
  }[];
}

export interface Recitation {
  id: number;
  studentId: number;
  studentName: string;
  studentAvatarUrl: string | null;
  halaqaId: number | null;
  halaqa: string;
  type: RecitationType;
  pageNumber: number;
  toPage: number | null;
  verse: number | null;
  pageCompleted: number;
  /** رقم السورة عند التسميع بالسور (جزء عمّ)، أو null للتسميع بالصفحة. */
  surahNumber: number | null;
  rating: Rating;
  notes: string | null;
  recitedAt: string;
  recordedBy: string;
  createdAt: string;
}

export interface LeaderboardRow {
  id: number;
  name: string;
  avatarUrl: string | null;
  group: string;
  points: number;
  /** نسبة الحضور المئوية. */
  attendance: number;
  /** أيام حضره فعلاً، من أصل أيام الدوام المسجَّلة له. */
  attendedDays: number;
  totalDays: number;
  /** مجموع الصفحات المسمّعة (السورة بوزنها من جزء عمّ، ونصف الصفحة 0.5). */
  recitationPages: number;
  recitationCount: number;
  rank: number;
}

export interface DashboardStats {
  date: string;
  /*
   * أرقام البطاقات اختيارية: الخادم يحجبها عن المشرف (دوره المتابعة
   * اليومية لا الإحصاء العام)، فلا تصل في ردّه أصلاً.
   */
  halaqat?: number;
  students?: number;
  halaqatRecordedToday?: number;
  attendanceRate?: number;
  presentToday?: number;
  recitationsToday?: number;
  /** آخر النشاطات: متابعة تشغيلية، تصل لكل الأدوار ضمن نطاقها. */
  recentActivity: { kind: string; student: string; at: string; detail: string }[];
}

export interface Paged<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

/** صف في دليل الكادر — يُعاد من /api/users (للمدير وحده). */
/** سطر طالب في تقرير اليوم: حضوره، ما سمّعه، ونقاط يومه. */
export interface DailyReportStudent {
  id: number;
  name: string;
  /** null = لم تُسجَّل جلسة حضور لهذا اليوم بعد. */
  status: AttendanceStatus | null;
  points: number;
  /** نقاط المشاركة اليدوية الممنوحة اليوم (من "نقاط سريعة"). */
  participation: number;
  /** حركات تلك النقاط بأسبابها، لتُعرض مع المجموع لا مجرّدةً منه. */
  participationEntries: { studentId: number; delta: number; reason: string | null }[];
  recitations: {
    studentId: number;
    type: RecitationType;
    pageNumber: number;
    toPage: number | null;
    surahNumber: number | null;
    rating: Rating;
  }[];
}

export interface DailyReport {
  halaqa: { id: number; name: string; teacher: string };
  date: string;
  /** هل سُجّل حضور هذا اليوم؟ */
  recorded: boolean;
  students: DailyReportStudent[];
}

export interface StaffUser {
  id: number;
  name: string;
  username: string | null;
  role: Role;
  isActive: number;
  createdAt: string;
  hasPassword: number;
  halaqatCount: number;
  halaqatNames: string | null;
}

/* ==================== شهادات وسبر الأوقاف ==================== */

/** حالة الطالب في دورة سبر الأوقاف — الترجمة في locales تحت awqafStatuses. */
export const AWQAF_STATUSES = ["nominated", "passed", "failed"] as const;
export type AwqafStatus = (typeof AWQAF_STATUSES)[number];

export interface AwqafRecord {
  id: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  studentAvatarUrl: string | null;
  halaqaId: number | null;
  halaqa: string;
  /** شهر السبر بصيغة YYYY-MM. */
  examMonth: string;
  status: AwqafStatus;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/* ==================== لوحة الإحصاءات ==================== */

/** نقطة في السلسلة الشهرية للتسميع. الشهر بصيغة YYYY-MM. */
export interface MonthlyRecitationPoint {
  month: string;
  /** الصفحات محسوبة بأوزان جزء عمّ ونصف الصفحة — نفس قاعدة لوحة الصدارة. */
  pages: number;
  count: number;
}

export interface AwqafPeriodStats {
  passed: number;
  nominated: number;
  failed: number;
  total: number;
}

export interface StatisticsDashboard {
  totals: {
    recitationPages: number;
    recitationCount: number;
    /** أيام سُجّلت فيها جلسة حضور واحدة على الأقل. */
    attendanceDays: number;
    attendanceSessions: number;
    awqafPassed: number;
    awqafTotal: number;
    students: number;
    halaqat: number;
  };
  /** متّصلة زمنياً: الأشهر الخالية تصل بأصفار فلا ينقطع الخطّ. */
  monthlyRecitation: MonthlyRecitationPoint[];
  awqafStats: {
    /** أشهر السبر المسجّلة فقط — لا تُملأ الفجوات (السبر واقعة متقطّعة). */
    byMonth: (AwqafPeriodStats & { month: string })[];
    byYear: (AwqafPeriodStats & { year: string })[];
  };
}
