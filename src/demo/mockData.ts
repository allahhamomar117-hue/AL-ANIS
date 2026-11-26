import type {
  AttendanceSession,
  AssignmentRecord,
  AuthUser,
  DashboardStats,
  Department,
  Halaqa,
  LeaderboardRow,
  PointTransaction,
  Recitation,
  StaffUser,
  Student,
} from "../lib/api/types";
import type {
  Badge,
  Tribe,
  TribeBadge,
  TribeFlagSettings,
  TribeLog,
  TribeStudent,
} from "../types/tribes";

export type DemoRole = Extract<AuthUser["role"], "ADMIN" | "TEACHER" | "SUPERVISOR">;

export interface DemoData {
  students: Student[];
  halaqat: Halaqa[];
  attendanceSessions: AttendanceSession[];
  pointTransactions: DemoPointTransaction[];
  assignments: AssignmentRecord[];
  recitations: Recitation[];
  staff: StaffUser[];
  tribes: Tribe[];
  badges: Badge[];
  tribeBadges: TribeBadge[];
  tribeFlagSettings: TribeFlagSettings;
  tribeStudents: TribeStudent[];
  tribeLogs: TribeLog[];
  recentActivity: DashboardStats["recentActivity"];
}

export interface DemoPointTransaction extends PointTransaction {
  studentId: number;
}

const departments: Department[] = ["PRIMARY", "MIDDLE_HIGH", "INTENSIVE"];

export const DEMO_HALAQAT: Halaqa[] = [
  { id: 1, name: "حلقة النور", teacherId: 3, teacher: "الأستاذ أحمد", stage: "primary", department: departments[0], scheduleTime: "08:00", location: "القاعة الأولى", isActive: 1, sortOrder: 1, students: 6 },
  { id: 2, name: "حلقة الإتقان", teacherId: 4, teacher: "الأستاذ يوسف", stage: "middle_high", department: departments[1], scheduleTime: "09:30", location: "القاعة الثانية", isActive: 1, sortOrder: 2, students: 6 },
  { id: 3, name: "حلقة الهمة", teacherId: 3, teacher: "الأستاذ أحمد", stage: "intensive", department: departments[2], scheduleTime: "11:00", location: "قاعة التحفيظ", isActive: 1, sortOrder: 3, students: 6 },
  { id: 4, name: "حلقة الفجر", teacherId: 4, teacher: "الأستاذ يوسف", stage: "primary", department: departments[0], scheduleTime: "08:45", location: "القاعة الثالثة", isActive: 1, sortOrder: 4, students: 6 },
  { id: 5, name: "حلقة البيان", teacherId: 3, teacher: "الأستاذ أحمد", stage: "middle_high", department: departments[1], scheduleTime: "10:15", location: "قاعة البيان", isActive: 1, sortOrder: 5, students: 6 },
  { id: 6, name: "حلقة الرواد", teacherId: 4, teacher: "الأستاذ يوسف", stage: "intensive", department: departments[2], scheduleTime: "12:00", location: "القاعة الرابعة", isActive: 1, sortOrder: 6, students: 5 },
];

const studentNames = [
  "أحمد محمد", "عمر خالد", "يوسف إبراهيم", "عبدالله حسن", "محمد علي",
  "إبراهيم محمود", "عبدالرحمن سامي", "مصطفى أحمد", "حمزة يوسف", "أنس خالد",
  "بلال عمر", "سعد محمد", "خالد عادل", "ياسين محمود", "زياد أحمد",
  "معاذ إبراهيم", "طارق حسن", "إسماعيل علي", "رامي يوسف", "فارس عبدالله",
  "مازن محمود", "نادر سامي", "حسن فؤاد", "لؤي أحمد", "جواد عمر",
  "سليم خالد", "عمار يوسف", "رائد محمد", "باسل إبراهيم", "إياد حسن",
  "كريم طارق", "مهند علي", "صهيب عادل", "نواف محمود", "أيمن سعد",
];

const studentScores = [248, 236, 221, 214, 203, 198, 187, 179, 171, 164, 157, 151, 145, 139, 132, 127, 121, 116, 109, 103, 98, 92, 87, 81, 76, 70, 65, 59, 54, 48, 43, 37, 32, 26, 19];

export const DEMO_STUDENTS: Student[] = studentNames.map((name, index) => {
  const halaqa = DEMO_HALAQAT[Math.min(Math.floor(index / 6), DEMO_HALAQAT.length - 1)];
  return {
    id: index + 1,
    code: `AN-${String(index + 1).padStart(3, "0")}`,
    name,
    halaqaId: halaqa.id,
    halaqa: halaqa.name,
    birthDate: `201${index % 5 + 2}-0${index % 8 + 1}-15`,
    studentPhone: null,
    parentPhone: `09${String(12345678 + index).slice(0, 8)}`,
    avatarUrl: index % 4 === 3
      ? null
      : `https://api.dicebear.com/9.x/adventurer/svg?seed=anis-student-${index + 1}&backgroundColor=b6e3f4,c0aede,d1d4f9&hair=short01,short02,short03,short04,short05,short06,short07,short08,short09,short10,short11,short12,short13,short14,short15,short16&earringsProbability=0`,
    points: studentScores[index],
    status: "active",
    isActive: 1,
    createdAt: new Date(Date.now() - (index + 2) * 86_400_000).toISOString(),
  };
});

export const DEMO_STAFF: StaffUser[] = [
  { id: 1, name: "المدير العام", username: "demo_admin", role: "ADMIN", departments: [], isActive: 1, createdAt: new Date().toISOString(), hasPassword: 1, halaqatCount: 0, halaqatNames: null },
  { id: 2, name: "المشرف التربوي", username: "demo_supervisor", role: "SUPERVISOR", departments: [], isActive: 1, createdAt: new Date().toISOString(), hasPassword: 1, halaqatCount: 0, halaqatNames: null },
  { id: 3, name: "الأستاذ أحمد", username: "demo_teacher", role: "TEACHER", departments: [], isActive: 1, createdAt: new Date().toISOString(), hasPassword: 1, halaqatCount: 3, halaqatNames: "حلقة النور، حلقة الهمة، حلقة البيان" },
  { id: 4, name: "الأستاذ يوسف", username: "yusuf", role: "TEACHER", departments: [], isActive: 1, createdAt: new Date().toISOString(), hasPassword: 1, halaqatCount: 3, halaqatNames: "حلقة الإتقان، حلقة الفجر، حلقة الرواد" },
];

export const DEMO_ATTENDANCE_SESSIONS: AttendanceSession[] = DEMO_HALAQAT.flatMap((halaqa) =>
  Array.from({ length: 14 }, (_, dayIndex) => {
    const date = new Date(Date.now() - dayIndex * 86_400_000).toISOString().slice(0, 10);
    return {
      id: halaqa.id * 100 + dayIndex + 1,
      halaqaId: halaqa.id,
      halaqa: halaqa.name,
      date,
      teacherStatus: dayIndex % 9 === 0 ? "absent" as const : "present" as const,
      notes: dayIndex % 5 === 0 ? "مراجعة أسبوعية" : null,
      students: DEMO_STUDENTS.filter((student) => student.halaqaId === halaqa.id).map((student, studentIndex) => ({
        id: student.id,
        studentId: student.id,
        name: student.name,
        code: student.code,
        avatarUrl: student.avatarUrl,
        status: (studentIndex + dayIndex) % 13 === 0 ? "absent" as const : (studentIndex + dayIndex) % 7 === 0 ? "late" as const : "present" as const,
      })),
    };
  }),
);

export const DEMO_POINT_TRANSACTIONS: DemoPointTransaction[] = DEMO_STUDENTS.flatMap((student, index) =>
  Array.from({ length: 3 }, (_, recordIndex) => ({
    id: index * 3 + recordIndex + 1,
    studentId: student.id,
    delta: Math.max(1, Math.round(student.points / (8 + recordIndex * 3))),
    reason: ["مواظبة في الحضور", "إنجاز مقرر الحفظ", "مشاركة متميزة"][recordIndex],
    kind: (["attendance", "manual", "recitation"] as const)[recordIndex],
    referenceId: null,
    createdAt: new Date(Date.now() - (index * 3 + recordIndex) * 3_600_000).toISOString(),
    createdBy: index % 2 === 0 ? "الأستاذ أحمد" : "الأستاذ يوسف",
  })),
);

export const DEMO_ASSIGNMENTS: AssignmentRecord[] = [
  { id: 1, halaqaId: 3, halaqa: "حلقة الهمة", title: "مراجعة سورة الملك", date: new Date().toISOString().slice(0, 10), students: DEMO_STUDENTS.slice(15, 19).map((student, index) => ({ id: index + 1, studentId: student.id, name: student.name, code: student.code, avatarUrl: student.avatarUrl })) },
  { id: 2, halaqaId: 3, halaqa: "حلقة الهمة", title: "حفظ سورة القلم", date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), students: DEMO_STUDENTS.slice(16, 20).map((student, index) => ({ id: index + 5, studentId: student.id, name: student.name, code: student.code, avatarUrl: student.avatarUrl })) },
];

export const DEMO_RECITATIONS: Recitation[] = DEMO_STUDENTS.flatMap((student, index) =>
  Array.from({ length: 4 }, (_, recordIndex) => {
    const daysAgo = (index % 20) + recordIndex * 30;
    return {
      id: index * 4 + recordIndex + 1,
      studentId: student.id,
      studentName: student.name,
      studentAvatarUrl: student.avatarUrl,
      halaqaId: student.halaqaId,
      halaqa: student.halaqa,
      type: recordIndex === 0 ? "full" as const : "half" as const,
      pageNumber: 1 + index * 2 + recordIndex,
      toPage: 2 + index * 2 + recordIndex,
      verse: null,
      pageCompleted: 1,
      surahNumber: null,
      rating: (index + recordIndex) % 4 === 0 ? "excellent" as const : (index + recordIndex) % 3 === 0 ? "needs" as const : "good" as const,
      notes: recordIndex === 1 ? "مراجعة متقنة" : null,
      recitedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10),
      recordedBy: index % 2 === 0 ? "الأستاذ أحمد" : "الأستاذ يوسف",
      createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    };
  }),
);

export const DEMO_RECENT_ACTIVITY: DashboardStats["recentActivity"] = Array.from({ length: 12 }, (_, index) => ({
  kind: (["attendance", "recitation", "points", "assignment"] as const)[index % 4],
  student: studentNames[index % studentNames.length],
  at: new Date(Date.now() - index * 18 * 60_000).toISOString(),
  detail: ["سجّل الحضور", "أتمّ تسميعاً جديداً", "حصل على نقاط تشجيعية", "أنجز مقرر اليوم"][index % 4],
}));

export const DEMO_TRIBES: Tribe[] = [
  { id: 1, name: "قبيلة النور", score: 126, theme_color: "#22c55e", bg_image_url: null },
  { id: 2, name: "قبيلة الهمة", score: 108, theme_color: "#38bdf8", bg_image_url: null },
  { id: 3, name: "قبيلة الإحسان", score: 94, theme_color: "#f59e0b", bg_image_url: null },
  { id: 4, name: "قبيلة الفلاح", score: 81, theme_color: "#f472b6", bg_image_url: null },
];

export const DEMO_BADGES: Badge[] = [
  { id: 1, title: "راية الإتقان", required_flags: 25, icon_url: null, description: "إنجاز جماعي متميز" },
  { id: 2, title: "راية المواظبة", required_flags: 40, icon_url: null, description: "الالتزام بالحضور" },
  { id: 3, title: "راية التلاوة", required_flags: 60, icon_url: null, description: "تقدم في الحفظ" },
  { id: 4, title: "راية السباق", required_flags: 80, icon_url: null, description: "روح المبادرة" },
];

export const DEMO_TRIBE_BADGES: TribeBadge[] = [
  { id: 1, tribe_id: 1, badge_id: 1, earned_at: new Date().toISOString() },
  { id: 2, tribe_id: 2, badge_id: 2, earned_at: new Date().toISOString() },
];

export const DEMO_TRIBE_SETTINGS: TribeFlagSettings = {
  id: 1,
  student_attendance: 1,
  excellent_page: 3,
  good_page: 2,
  medium_page: 1,
  assignment_completion: 2,
  awqaf_certificate: 10,
};

export const DEMO_TRIBE_STUDENTS: TribeStudent[] = DEMO_STUDENTS.map((student, index) => ({
  id: index + 1,
  tribe_id: (index % DEMO_TRIBES.length) + 1,
  student_id: student.id,
  assigned_at: new Date().toISOString(),
}));

export const DEMO_TRIBE_LOGS: TribeLog[] = DEMO_STUDENTS.slice(0, 8).map((student, index) => ({
  id: index + 1,
  tribe_id: (index % DEMO_TRIBES.length) + 1,
  student_id: student.id,
  student_name: student.name,
  flags_added: index + 1,
  reason: "إنجاز في الحفظ والتلاوة",
  created_at: new Date(Date.now() - index * 3_600_000).toISOString(),
}));

export function createInitialDemoData(): DemoData {
  return {
    students: structuredClone(DEMO_STUDENTS),
    halaqat: structuredClone(DEMO_HALAQAT),
    attendanceSessions: structuredClone(DEMO_ATTENDANCE_SESSIONS),
    pointTransactions: structuredClone(DEMO_POINT_TRANSACTIONS),
    assignments: structuredClone(DEMO_ASSIGNMENTS),
    recitations: structuredClone(DEMO_RECITATIONS),
    staff: structuredClone(DEMO_STAFF),
    tribes: structuredClone(DEMO_TRIBES),
    badges: structuredClone(DEMO_BADGES),
    tribeBadges: structuredClone(DEMO_TRIBE_BADGES),
    tribeFlagSettings: structuredClone(DEMO_TRIBE_SETTINGS),
    tribeStudents: structuredClone(DEMO_TRIBE_STUDENTS),
    tribeLogs: structuredClone(DEMO_TRIBE_LOGS),
    recentActivity: structuredClone(DEMO_RECENT_ACTIVITY),
  };
}

export function toDemoUser(role: DemoRole): AuthUser {
  const staff = DEMO_STAFF.find((user) => user.role === role);
  const primaryHalaqa = role === "TEACHER" ? DEMO_HALAQAT[0] : null;
  return {
    id: staff?.id ?? 1,
    name: staff?.name ?? "زائر تجريبي",
    username: staff?.username ?? null,
    phone_number: null,
    country_code: "963",
    role,
    departments: [],
    halaqa_id: primaryHalaqa?.id ?? null,
    halaqa_name: primaryHalaqa?.name ?? null,
    halaqat: role === "TEACHER"
      ? DEMO_HALAQAT.filter((halaqa) => halaqa.teacherId === staff?.id).map(({ id, name }) => ({ id, name }))
      : [],
  };
}

export function createDemoLeaderboard(students: Student[]): LeaderboardRow[] {
  return [...students]
    .filter((student) => student.status === "active" && student.isActive === 1)
    .sort((first, second) => second.points - first.points)
    .map((student, index) => ({
      id: student.id,
      name: student.name,
      avatarUrl: student.avatarUrl,
      group: student.halaqa,
      points: student.points,
      attendance: Math.max(70, 98 - index),
      attendedDays: Math.max(14, 25 - index),
      totalDays: 26,
      recitationPages: Math.max(12, 72 - index * 3),
      recitationCount: Math.max(5, 28 - index),
      rank: index + 1,
    }));
}