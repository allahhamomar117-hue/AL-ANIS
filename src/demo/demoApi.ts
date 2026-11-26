import type {
  AttendanceEntry,
  AttendanceSession,
  AttendanceStatus,
  AuthUser,
  Halaqa,
  Student,
} from "../lib/api/types";
import type { Tribe, TribeLog } from "../types/tribes";
import { getDemoSnapshot, getDemoUser, isDemoMode, updateDemoData } from "./demoStore";
import { createDemoLeaderboard, type DemoData } from "./mockData";

export type DemoHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type DemoQuery = Record<string, string | number | boolean | undefined | null>;

const waitForMockNetwork = () => new Promise<void>((resolve) => window.setTimeout(resolve, 120));

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function stringOf(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberOf(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function queryString(query: DemoQuery, key: string, fallback = ""): string {
  const value = query[key];
  return value === undefined || value === null ? fallback : String(value);
}

function findStudent(data: { students: Student[] }, id: number): Student | undefined {
  return data.students.find((student) => student.id === id);
}

function nextId(ids: number[]): number {
  return Math.max(0, ...ids) + 1;
}

function studentStats(studentId: number, attendanceSessions: AttendanceSession[]) {
  const entries = attendanceSessions.flatMap((session) => session.students)
    .filter((entry) => entry.studentId === studentId);
  const attended = entries.filter((entry) => entry.status === "present" || entry.status === "late").length;
  return {
    attendance: { sessions: entries.length, attended, rate: entries.length ? Math.round(attended / entries.length * 100) : 0 },
    recitations: { total: 8, excellent: 4, lastDate: new Date().toISOString().slice(0, 10) },
  };
}

function attendanceEntry(data: { students: Student[] }, studentId: number, status: AttendanceStatus): AttendanceEntry | null {
  const student = findStudent(data, studentId);
  return student ? { id: student.id, studentId: student.id, name: student.name, code: student.code, avatarUrl: student.avatarUrl, status } : null;
}

function demoChartSeries(data: DemoData, period: string) {
  const bucketCount = period === "daily" ? 14 : 6;
  const points = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date();
    if (period === "daily") date.setDate(date.getDate() - (bucketCount - index - 1));
    else date.setMonth(date.getMonth() - (bucketCount - index - 1), 1);
    const bucket = period === "daily" ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7);
    const recitations = data.recitations.filter((item) => item.recitedAt.startsWith(bucket));
    const sessions = data.attendanceSessions.filter((item) => item.date.startsWith(bucket));
    const attended = sessions.reduce((total, session) => total + session.students.filter((entry) => entry.status === "present" || entry.status === "late").length, 0);
    const registered = sessions.reduce((total, session) => total + session.students.length, 0);
    return {
      bucket,
      pages: recitations.reduce((total, item) => total + Math.max(1, (item.toPage ?? item.pageNumber) - item.pageNumber + 1), 0),
      count: recitations.length,
      attended,
      absent: sessions.reduce((total, session) => total + session.students.filter((entry) => entry.status === "absent").length, 0),
      excused: sessions.reduce((total, session) => total + session.students.filter((entry) => entry.status === "excused").length, 0),
      total: registered,
      rate: registered ? Math.round((attended / registered) * 100) : 0,
    };
  });
  return {
    recitation: points.map(({ bucket, pages, count }) => ({ bucket, pages, count })),
    attendance: points.map(({ bucket, attended, absent, excused, total, rate }) => ({ bucket, attended, absent, excused, total, rate })),
  };
}

export async function handleDemoApiRequest(
  method: DemoHttpMethod,
  path: string,
  body: unknown,
  query: DemoQuery = {},
): Promise<unknown> {
  if (!isDemoMode()) throw new Error("Demo mode is not active.");
  await waitForMockNetwork();
  const cleanPath = path.split("?")[0].replace(/\/+$/, "") || "/";
  const bodyRecord = recordOf(body);
  const user = getDemoUser();

  if (cleanPath === "/auth/me" && method === "GET") return { user };
  if ((cleanPath === "/auth/login" || cleanPath === "/auth/verify-otp") && method === "POST") {
    return { token: "local-demo-session", user: user as AuthUser };
  }
  if (cleanPath.startsWith("/auth/") && method === "POST") return { message: "تم تنفيذ العملية في وضع التجربة", expires_in_minutes: 5 };

  if (cleanPath === "/halaqat" && method === "GET") {
    return { data: getDemoSnapshot().data.halaqat };
  }
  const halaqaStudentsMatch = cleanPath.match(/^\/halaqat\/(\d+)\/students$/);
  if (halaqaStudentsMatch && method === "GET") {
    const halaqaId = Number(halaqaStudentsMatch[1]);
    const snapshot = getDemoSnapshot().data;
    const students = snapshot.students.filter((student) => student.halaqaId === halaqaId);
    return { data: students.map((student) => ({ id: student.id, code: student.code, name: student.name, points: student.points, avatarUrl: student.avatarUrl, lastRecitation: null, lastPage: null })) };
  }
  const halaqaMatch = cleanPath.match(/^\/halaqat\/(\d+)$/);
  if (halaqaMatch) {
    const id = Number(halaqaMatch[1]);
    const snapshot = getDemoSnapshot().data;
    const halaqa = snapshot.halaqat.find((item) => item.id === id);
    if (method === "GET") return { data: halaqa ?? null };
    if (method === "PATCH" && halaqa) {
      let updated: Halaqa = halaqa;
      updateDemoData((data) => {
        const index = data.halaqat.findIndex((item) => item.id === id);
        updated = { ...data.halaqat[index], ...bodyRecord } as Halaqa;
        data.halaqat[index] = updated;
      });
      return { data: updated };
    }
    if (method === "DELETE") {
      updateDemoData((data) => { data.halaqat = data.halaqat.filter((item) => item.id !== id); });
      return undefined;
    }
  }
  if (cleanPath === "/halaqat" && method === "POST") {
    let created: Halaqa | undefined;
    updateDemoData((data) => {
      const id = nextId(data.halaqat.map((item) => item.id));
      created = { id, name: stringOf(bodyRecord.name, `حلقة ${id}`), teacherId: numberOf(bodyRecord.teacher_id) || null, teacher: "الأستاذ أحمد", stage: null, department: null, scheduleTime: null, location: null, isActive: 1, sortOrder: id, students: 0 };
      data.halaqat.push(created);
    });
    return { data: created };
  }
  if (cleanPath === "/halaqat/order" && method === "PATCH") return { data: { ordered: numberOf(recordOf(body).ids && Array.isArray(recordOf(body).ids) ? (recordOf(body).ids as unknown[]).length : 0) } };

  if (cleanPath === "/students" && method === "GET") {
    const snapshot = getDemoSnapshot().data;
    const search = queryString(query, "search").toLocaleLowerCase();
    const halaqaId = numberOf(query.halaqaId);
    const status = queryString(query, "status", "active");
    const filtered = snapshot.students.filter((student) =>
      (!search || student.name.toLocaleLowerCase().includes(search) || student.code.toLocaleLowerCase().includes(search)) &&
      (!halaqaId || student.halaqaId === halaqaId) &&
      (status === "all" || student.status === status),
    );
    const offset = Math.max(0, numberOf(query.offset));
    const limit = Math.max(0, numberOf(query.limit, filtered.length));
    return { data: filtered.slice(offset, offset + limit), meta: { total: filtered.length, limit, offset } };
  }
  if (cleanPath === "/students" && method === "POST") {
    let created: Student | undefined;
    updateDemoData((data) => {
      const id = nextId(data.students.map((student) => student.id));
      const halaqaId = numberOf(bodyRecord.halaqa_id) || null;
      const halaqa = data.halaqat.find((item) => item.id === halaqaId);
      created = { id, code: stringOf(bodyRecord.code, `AN-${String(id).padStart(3, "0")}`), name: stringOf(bodyRecord.name, "طالب جديد"), halaqaId, halaqa: halaqa?.name ?? "بدون حلقة", birthDate: stringOf(bodyRecord.birth_date) || null, studentPhone: stringOf(bodyRecord.student_phone) || null, parentPhone: stringOf(bodyRecord.parent_phone) || null, avatarUrl: null, points: 0, status: "active", isActive: 1, createdAt: new Date().toISOString() };
      data.students.unshift(created);
    });
    return { data: created };
  }
  const studentPointsMatch = cleanPath.match(/^\/students\/(\d+)\/points$/);
  if (studentPointsMatch) {
    const id = Number(studentPointsMatch[1]);
    const snapshot = getDemoSnapshot().data;
    const student = findStudent(snapshot, id);
    if (method === "GET") {
      const rows = snapshot.pointTransactions.filter((transaction) => transaction.studentId === id);
      return { data: rows, meta: { balance: student?.points ?? 0 } };
    }
    if (method === "POST" && student) {
      const amount = Math.abs(numberOf(bodyRecord.amount));
      const delta = bodyRecord.operation === "deduct" ? -amount : amount;
      let balance = student.points;
      let transactionId = 0;
      updateDemoData((data) => {
        const target = findStudent(data, id);
        if (!target) return;
        target.points += delta;
        balance = target.points;
        transactionId = nextId(data.pointTransactions.map((transaction) => transaction.id));
        data.pointTransactions.unshift({ id: transactionId, studentId: id, delta, reason: stringOf(bodyRecord.reason) || null, kind: "manual", referenceId: null, createdAt: new Date().toISOString(), createdBy: getDemoUser()?.name ?? "زائر" });
      });
      return { data: { id: transactionId, delta, balance } };
    }
  }
  const studentAvatarMatch = cleanPath.match(/^\/students\/(\d+)\/avatar$/);
  const studentStatusMatch = cleanPath.match(/^\/students\/(\d+)\/status$/);
  const studentTransferMatch = cleanPath.match(/^\/students\/(\d+)\/transfer$/);
  const studentBulkMatch = cleanPath === "/students/bulk-transfer";
  const studentMatch = cleanPath.match(/^\/students\/(\d+)$/);
  if (studentAvatarMatch || studentStatusMatch || studentTransferMatch || studentMatch) {
    const match = studentAvatarMatch ?? studentStatusMatch ?? studentTransferMatch ?? studentMatch;
    const id = Number(match?.[1]);
    const snapshot = getDemoSnapshot().data;
    const current = findStudent(snapshot, id);
    if (method === "GET" && studentMatch) return { data: current ?? null, stats: studentStats(id, snapshot.attendanceSessions) };
    if (method === "DELETE") {
      if (studentAvatarMatch) {
        let updated: Student | undefined;
        updateDemoData((data) => {
          const target = findStudent(data, id);
          if (target) { target.avatarUrl = null; updated = target; }
        });
        return { data: updated };
      }
      updateDemoData((data) => { data.students = data.students.filter((student) => student.id !== id); });
      return undefined;
    }
    if ((method === "PATCH" || method === "POST") && current) {
      let updated: Student = current;
      updateDemoData((data) => {
        const target = findStudent(data, id);
        if (!target) return;
        if (studentStatusMatch && typeof bodyRecord.status === "string") target.status = bodyRecord.status as Student["status"];
        else if (studentTransferMatch) target.halaqaId = numberOf(bodyRecord.halaqa_id) || null;
        else if (studentAvatarMatch) target.avatarUrl = stringOf(bodyRecord.data) || null;
        else {
          if (typeof bodyRecord.name === "string") target.name = bodyRecord.name;
          if (typeof bodyRecord.halaqa_id === "number" || bodyRecord.halaqa_id === null) target.halaqaId = bodyRecord.halaqa_id;
          if (typeof bodyRecord.is_active === "boolean") target.isActive = bodyRecord.is_active ? 1 : 0;
          if (typeof bodyRecord.birth_date === "string" || bodyRecord.birth_date === null) target.birthDate = bodyRecord.birth_date;
          if (typeof bodyRecord.student_phone === "string" || bodyRecord.student_phone === null) target.studentPhone = bodyRecord.student_phone;
          if (typeof bodyRecord.parent_phone === "string" || bodyRecord.parent_phone === null) target.parentPhone = bodyRecord.parent_phone;
        }
        const halaqa = data.halaqat.find((item) => item.id === target.halaqaId);
        target.halaqa = halaqa?.name ?? "بدون حلقة";
        updated = target;
      });
      return { data: updated };
    }
  }
  if (studentBulkMatch && method === "POST") {
    const moved: Student[] = [];
    updateDemoData((data) => {
      const ids = Array.isArray(bodyRecord.studentIds) ? bodyRecord.studentIds.filter((value): value is number => typeof value === "number") : [];
      const halaqaId = numberOf(bodyRecord.newHalaqaId);
      const halaqa = data.halaqat.find((item) => item.id === halaqaId);
      data.students.forEach((student) => {
        if (!ids.includes(student.id)) return;
        student.halaqaId = halaqaId;
        student.halaqa = halaqa?.name ?? "بدون حلقة";
        moved.push(student);
      });
    });
    return { data: moved, meta: { moved: moved.length, halaqaId: numberOf(bodyRecord.newHalaqaId) } };
  }

  const attendanceSheetMatch = cleanPath.match(/^\/attendance\/halaqat\/(\d+)$/);
  if (attendanceSheetMatch && method === "GET") {
    const halaqaId = Number(attendanceSheetMatch[1]);
    const date = queryString(query, "date", new Date().toISOString().slice(0, 10));
    const snapshot = getDemoSnapshot().data;
    const session = snapshot.attendanceSessions.find((item) => item.halaqaId === halaqaId && item.date === date);
    const halaqa = snapshot.halaqat.find((item) => item.id === halaqaId);
    const students = snapshot.students.filter((student) => student.halaqaId === halaqaId && student.status === "active");
    return { data: { halaqa: { id: halaqaId, name: halaqa?.name ?? "حلقة", teacher: halaqa?.teacher ?? "الأستاذ" }, date, sessionId: session?.id ?? null, teacherStatus: session?.teacherStatus ?? "present", notes: session?.notes ?? null, recorded: Boolean(session), students: students.map((student) => ({ id: student.id, code: student.code, name: student.name, avatarUrl: student.avatarUrl, status: session?.students.find((entry) => entry.studentId === student.id)?.status ?? "present" })) } };
  }
  if (cleanPath === "/attendance" && method === "POST") {
    let saved: AttendanceSession | undefined;
    updateDemoData((data) => {
      const halaqaId = numberOf(bodyRecord.halaqaId);
      const date = stringOf(bodyRecord.date, new Date().toISOString().slice(0, 10));
      const halaqa = data.halaqat.find((item) => item.id === halaqaId);
      const studentsRaw = Array.isArray(bodyRecord.students) ? bodyRecord.students : [];
      const students = studentsRaw.flatMap((entry) => {
        const item = recordOf(entry);
        const status = item.status as AttendanceStatus;
        const mapped = attendanceEntry(data, numberOf(item.id), status);
        return mapped ? [mapped] : [];
      });
      const prior = data.attendanceSessions.find((session) => session.halaqaId === halaqaId && session.date === date);
      const id = prior?.id ?? nextId(data.attendanceSessions.map((session) => session.id));
      saved = { id, halaqaId, halaqa: halaqa?.name ?? "حلقة", date, teacherStatus: bodyRecord.teacherStatus === "absent" ? "absent" : "present", notes: stringOf(bodyRecord.notes) || null, students };
      data.attendanceSessions = [saved, ...data.attendanceSessions.filter((session) => session.id !== id)];
    });
    return { data: saved };
  }
  if (cleanPath === "/attendance/sessions" && method === "GET") {
    const snapshot = getDemoSnapshot().data;
    return { data: snapshot.attendanceSessions.filter((session) => !query.halaqaId || session.halaqaId === numberOf(query.halaqaId)) };
  }
  const attendanceStudentMatch = cleanPath.match(/^\/attendance\/sessions\/(\d+)\/students\/(\d+)$/);
  const attendanceSessionMatch = cleanPath.match(/^\/attendance\/sessions\/(\d+)$/);
  if (attendanceStudentMatch) {
    const sessionId = Number(attendanceStudentMatch[1]);
    const studentId = Number(attendanceStudentMatch[2]);
    let students: AttendanceEntry[] = [];
    updateDemoData((data) => {
      const session = data.attendanceSessions.find((item) => item.id === sessionId);
      if (!session) return;
      if (method === "PATCH") {
        const status = bodyRecord.status as AttendanceStatus;
        session.students = session.students.map((entry) => entry.studentId === studentId ? { ...entry, status } : entry);
      } else if (method === "DELETE") session.students = session.students.filter((entry) => entry.studentId !== studentId);
      students = session.students;
    });
    return method === "DELETE" ? undefined : { data: students };
  }
  if (attendanceSessionMatch) {
    const id = Number(attendanceSessionMatch[1]);
    const snapshot = getDemoSnapshot().data;
    const session = snapshot.attendanceSessions.find((item) => item.id === id);
    if (method === "GET") return { data: session ?? null };
    if (method === "DELETE") { updateDemoData((data) => { data.attendanceSessions = data.attendanceSessions.filter((item) => item.id !== id); }); return undefined; }
  }

  const assignmentSheetMatch = cleanPath.match(/^\/assignments\/halaqat\/(\d+)$/);
  if (assignmentSheetMatch && method === "GET") {
    const halaqaId = Number(assignmentSheetMatch[1]);
    const date = queryString(query, "date", new Date().toISOString().slice(0, 10));
    const data = getDemoSnapshot().data;
    const halaqa = data.halaqat.find((item) => item.id === halaqaId);
    const assignment = data.assignments.find((item) => item.halaqaId === halaqaId && item.date === date);
    return { data: { halaqa: { id: halaqaId, name: halaqa?.name ?? "حلقة", teacher: halaqa?.teacher ?? "الأستاذ" }, date, assignmentId: assignment?.id ?? null, title: assignment?.title ?? "", recorded: Boolean(assignment), pointsPerCompletion: 2, students: data.students.filter((student) => student.halaqaId === halaqaId).map((student) => ({ id: student.id, code: student.code, name: student.name, avatarUrl: student.avatarUrl, completedId: assignment?.students.find((entry) => entry.studentId === student.id)?.id ?? null })) } };
  }
  if (cleanPath === "/assignments" && method === "GET") return { data: getDemoSnapshot().data.assignments };
  if (cleanPath === "/assignments" && method === "POST") {
    let created: import("./mockData").DemoData["assignments"][number] | undefined;
    updateDemoData((data) => {
      const halaqaId = numberOf(bodyRecord.halaqaId);
      const halaqa = data.halaqat.find((item) => item.id === halaqaId);
      const ids = Array.isArray(bodyRecord.students) ? bodyRecord.students.filter((value): value is number => typeof value === "number") : [];
      const students = data.students.filter((student) => ids.includes(student.id)).map((student, index) => ({ id: index + 1, studentId: student.id, name: student.name, code: student.code, avatarUrl: student.avatarUrl }));
      const date = stringOf(bodyRecord.date, new Date().toISOString().slice(0, 10));
      const existing = data.assignments.find((item) => item.halaqaId === halaqaId && item.date === date);
      const newAssignment = { id: existing?.id ?? nextId(data.assignments.map((item) => item.id)), halaqaId, halaqa: halaqa?.name ?? "حلقة", title: stringOf(bodyRecord.title), date, students };
      created = newAssignment;
      data.assignments = [newAssignment, ...data.assignments.filter((item) => item.id !== newAssignment.id)];
    });
    return { data: created };
  }
  const assignmentMatch = cleanPath.match(/^\/assignments\/(\d+)$/);
  if (assignmentMatch) {
    const id = Number(assignmentMatch[1]);
    const data = getDemoSnapshot().data;
    const assignment = data.assignments.find((item) => item.id === id);
    if (method === "GET") return { data: assignment ?? null };
    if (method === "DELETE") { updateDemoData((draft) => { draft.assignments = draft.assignments.filter((item) => item.id !== id); }); return undefined; }
  }

  if (cleanPath === "/reports/leaderboard" && method === "GET") {
    const data = getDemoSnapshot().data;
    let rows = createDemoLeaderboard(data.students);
    if (query.halaqaId) rows = rows.filter((row) => data.students.find((student) => student.id === row.id)?.halaqaId === numberOf(query.halaqaId));
    if (query.department) rows = rows.filter((row) => data.halaqat.find((halaqa) => halaqa.name === row.group)?.department === query.department);
    const type = queryString(query, "type", "points");
    rows.sort((first, second) => type === "attendance" ? second.attendance - first.attendance : type === "recitation" ? second.recitationPages - first.recitationPages : second.points - first.points);
    rows = rows.map((row, index) => ({ ...row, rank: index + 1 }));
    return { data: rows, meta: { type, from: null, to: null } };
  }
  if (cleanPath === "/reports/dashboard" && method === "GET") {
    const data = getDemoSnapshot().data;
    const today = new Date().toISOString().slice(0, 10);
    const sessionsToday = data.attendanceSessions.filter((session) => session.date === today);
    const presentToday = sessionsToday.reduce((total, session) => total + session.students.filter((entry) => entry.status === "present" || entry.status === "late").length, 0);
    const registeredToday = sessionsToday.reduce((total, session) => total + session.students.length, 0);
    const pagesToday = data.recitations.filter((entry) => entry.recitedAt === today).reduce((total, entry) => total + Math.max(1, (entry.toPage ?? entry.pageNumber) - entry.pageNumber + 1), 0);
    return { data: { date: queryString(query, "date", today), halaqat: data.halaqat.length, students: data.students.filter((student) => student.status === "active").length, halaqatRecordedToday: sessionsToday.length, attendanceRate: registeredToday ? Math.round(presentToday / registeredToday * 100) : 0, presentToday, recitationPagesToday: pagesToday, recentActivity: data.recentActivity } };
  }

  if (cleanPath === "/recitations" && method === "GET") {
    const data = getDemoSnapshot().data.recitations;
    return { data, meta: { total: data.length, limit: data.length, offset: 0 } };
  }
  if (cleanPath === "/recitations" && method === "POST") {
    let created;
    updateDemoData((data) => {
      const studentId = numberOf(bodyRecord.studentId);
      const student = findStudent(data, studentId);
      const id = nextId(data.recitations.map((entry) => entry.id));
      created = { id, studentId, studentName: student?.name ?? "طالب", studentAvatarUrl: student?.avatarUrl ?? null, halaqaId: student?.halaqaId ?? null, halaqa: student?.halaqa ?? "", type: bodyRecord.type ?? "full", pageNumber: numberOf(bodyRecord.pageNumber, 1), toPage: numberOf(bodyRecord.toPage) || null, verse: numberOf(bodyRecord.verse) || null, pageCompleted: bodyRecord.pageCompleted === false ? 0 : 1, surahNumber: numberOf(bodyRecord.surahNumber) || null, rating: bodyRecord.rating ?? "good", notes: stringOf(bodyRecord.notes) || null, recitedAt: stringOf(bodyRecord.recitedAt, new Date().toISOString()), recordedBy: getDemoUser()?.name ?? "زائر", createdAt: new Date().toISOString() };
      data.recitations.unshift(created as (typeof data.recitations)[number]);
    });
    return { data: created };
  }
  const recitationMatch = cleanPath.match(/^\/recitations\/(\d+)$/);
  if (recitationMatch) {
    const id = Number(recitationMatch[1]);
    const recitation = getDemoSnapshot().data.recitations.find((item) => item.id === id);
    if (method === "GET") return { data: recitation ?? null };
    if (method === "PATCH" && recitation) {
      let updated = recitation;
      updateDemoData((data) => { const index = data.recitations.findIndex((item) => item.id === id); updated = { ...data.recitations[index], ...bodyRecord } as typeof recitation; data.recitations[index] = updated; });
      return { data: updated };
    }
    if (method === "DELETE") { updateDemoData((data) => { data.recitations = data.recitations.filter((item) => item.id !== id); }); return undefined; }
  }

  if (cleanPath === "/users" && method === "GET") return { data: getDemoSnapshot().data.staff };
  if (cleanPath === "/users" && method === "POST") {
    let created;
    updateDemoData((data) => {
      const id = nextId(data.staff.map((staff) => staff.id));
      const role = bodyRecord.role === "TEACHER" || bodyRecord.role === "SUPERVISOR" ? bodyRecord.role : "ADMIN";
      created = { id, name: stringOf(bodyRecord.name, "موظف جديد"), username: stringOf(bodyRecord.username), role, departments: [], isActive: 1, createdAt: new Date().toISOString(), hasPassword: 1, halaqatCount: 0, halaqatNames: null };
      data.staff.push(created as (typeof data.staff)[number]);
    });
    return { data: created };
  }
  const userMatch = cleanPath.match(/^\/users\/(\d+)(?:\/(password|halaqat|permanent))?$/);
  if (userMatch) {
    const id = Number(userMatch[1]);
    const suffix = userMatch[2];
    const staff = getDemoSnapshot().data.staff.find((entry) => entry.id === id);
    if (suffix === "halaqat") {
      if (method === "GET") return { data: [] };
      if (method === "PUT") return { data: [] };
    }
    if (suffix === "password" && method === "PUT") return { data: staff };
    if (method === "PATCH" && staff) {
      let updated = staff;
      updateDemoData((data) => { const index = data.staff.findIndex((entry) => entry.id === id); updated = { ...data.staff[index], ...bodyRecord } as typeof staff; data.staff[index] = updated; });
      return { data: updated };
    }
    if (method === "DELETE") { updateDemoData((data) => { data.staff = data.staff.filter((entry) => entry.id !== id); }); return suffix === "permanent" ? { data: { id, name: staff?.name ?? "" } } : { data: staff };
    }
  }

  if (cleanPath === "/statistics/dashboard" && method === "GET") {
    const data = getDemoSnapshot().data;
    const period = queryString(query, "period", "monthly");
    const series = demoChartSeries(data, period);
    return {
      data: {
        totals: {
          recitationPages: data.recitations.reduce((total, item) => total + Math.max(1, (item.toPage ?? item.pageNumber) - item.pageNumber + 1), 0),
          recitationCount: data.recitations.length,
          attendanceDays: new Set(data.attendanceSessions.map((session) => session.date)).size,
          attendanceSessions: data.attendanceSessions.length,
          awqafPassed: 6,
          awqafTotal: 9,
          students: data.students.length,
          halaqat: data.halaqat.length,
        },
        recitationSeries: { period, points: series.recitation },
        attendanceSeries: { period, points: series.attendance },
        awqafStats: {
          byMonth: [{ month: new Date().toISOString().slice(0, 7), passed: 6, nominated: 2, failed: 1, total: 9 }],
          byYear: [{ year: String(new Date().getFullYear()), passed: 6, nominated: 2, failed: 1, total: 9 }],
        },
      },
    };
  }
  if (cleanPath === "/awqaf" && method === "GET") return { data: [], meta: { months: [] } };
  if (cleanPath.startsWith("/awqaf/") && method === "GET") return { data: null };

  return { data: [] };
}

function supabaseMatch(row: Record<string, unknown>, key: string, filter: string): boolean {
  const separator = filter.indexOf(".");
  if (separator < 0) return true;
  const operator = filter.slice(0, separator);
  const expected = filter.slice(separator + 1);
  if (operator !== "eq") return true;
  return String(row[key] ?? "") === expected;
}

export async function handleDemoTableRequest<T>(
  table: string,
  method: DemoHttpMethod,
  params: Record<string, string>,
  body?: unknown,
): Promise<T> {
  if (!isDemoMode()) throw new Error("Demo mode is not active.");
  await waitForMockNetwork();
  const bodyRecord = recordOf(body);
  let result: unknown = [];

  updateDemoData((data) => {
    switch (table) {
      case "tribes":
        result = tableMutation(data.tribes, method, params, bodyRecord, (row) => data.tribes = row as Tribe[]);
        break;
      case "badges":
        result = tableMutation(data.badges, method, params, bodyRecord, (row) => data.badges = row as typeof data.badges);
        break;
      case "tribe_badges":
        result = tableMutation(data.tribeBadges, method, params, bodyRecord, (row) => data.tribeBadges = row as typeof data.tribeBadges);
        break;
      case "tribe_flag_settings":
        if (method === "GET") result = [data.tribeFlagSettings];
        if (method === "PATCH") { data.tribeFlagSettings = { ...data.tribeFlagSettings, ...bodyRecord }; result = [data.tribeFlagSettings]; }
        break;
      case "tribe_students":
        if (method === "POST") {
          const studentId = numberOf(bodyRecord.student_id);
          const tribeId = numberOf(bodyRecord.tribe_id);
          const existing = data.tribeStudents.find((item) => item.student_id === studentId);
          if (existing) { existing.tribe_id = tribeId; result = [existing]; }
          else { const created = { id: nextId(data.tribeStudents.map((item) => item.id)), student_id: studentId, tribe_id: tribeId, assigned_at: new Date().toISOString() }; data.tribeStudents.push(created); result = [created]; }
        } else if (method === "DELETE") {
          data.tribeStudents = data.tribeStudents.filter((row) => !params.student_id || !supabaseMatch(row as unknown as Record<string, unknown>, "student_id", params.student_id));
          result = undefined;
        } else result = filterTable(data.tribeStudents, params);
        break;
      case "tribe_logs":
        if (method === "POST") {
          const created: TribeLog = { id: nextId(data.tribeLogs.map((item) => item.id)), tribe_id: numberOf(bodyRecord.tribe_id), student_id: numberOf(bodyRecord.student_id) || null, student_name: stringOf(bodyRecord.student_name), flags_added: numberOf(bodyRecord.flags_added), reason: stringOf(bodyRecord.reason), created_at: stringOf(bodyRecord.created_at, new Date().toISOString()) };
          data.tribeLogs.unshift(created);
          result = [created];
        } else result = filterTable(data.tribeLogs, params);
        break;
      default:
        result = [];
    }
  });
  return result as T;
}

function filterTable<T extends { id: number }>(rows: T[], params: Record<string, string>): T[] {
  return rows.filter((row) => Object.entries(params).every(([key, filter]) => key === "select" || key === "order" || key === "limit" || supabaseMatch(row as Record<string, unknown>, key, filter)));
}

function tableMutation<T extends { id: number }>(
  rows: T[],
  method: DemoHttpMethod,
  params: Record<string, string>,
  body: Record<string, unknown>,
  setRows: (rows: T[]) => void,
): unknown {
  const selected = filterTable(rows, params);
  if (method === "GET") return selected;
  if (method === "POST") {
    const created = { ...body, id: nextId(rows.map((row) => row.id)) } as T;
    setRows([...rows, created]);
    return [created];
  }
  if (method === "PATCH") {
    const updated = rows.map((row) => selected.some((item) => item.id === row.id) ? { ...row, ...body } : row);
    setRows(updated);
    return updated.filter((row) => selected.some((item) => item.id === row.id));
  }
  if (method === "DELETE") {
    setRows(rows.filter((row) => !selected.some((item) => item.id === row.id)));
    return undefined;
  }
  return selected;
}

