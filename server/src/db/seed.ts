/**
 * بيانات تجريبية مطابقة للأسماء المستخدمة حالياً في الواجهات.
 * التشغيل: npm run db:seed
 */
import { config } from "../config.js";
import { db, migrate, tx } from "./index.js";
import { addPoints } from "../services/points.js";
import { hashPassword } from "../lib/password.js";

migrate();

const teachers = [
  // اسم الدخول وكلمة المرور لكل حساب — بيانات تجريبية للتطوير المحلي
  { name: "أيهم شعرية", username: "أيهم شعرية", password: "123", phone: "930000001", role: "TEACHER" },
  { name: "أ. عمر خالد", username: "عمر خالد", password: "123", phone: "930000002", role: "TEACHER" },
  { name: "أ. ياسين محمود", username: "ياسين محمود", password: "123", phone: "930000003", role: "TEACHER" },
  { name: "أ. محمد أحمد", username: "محمد أحمد", password: "123", phone: "930000004", role: "TEACHER" },
  { name: "عمار شهوري", username: "عمار شهوري", password: "123", phone: "930000000", role: "ADMIN" },
];

/** teacher = فهرس الأستاذ في مصفوفة teachers أعلاه. */
const halaqat = [
  { name: "حلقة الهداية", teacher: 0, time: "16:00" },
  { name: "حلقة التقوى", teacher: 1, time: "17:00" },
  { name: "حلقة النور", teacher: 2, time: "18:00" },
  { name: "حلقة الفجر", teacher: 3, time: "05:00" },
];

/** halaqa = فهرس الحلقة في مصفوفة halaqat أعلاه. */
const students = [
  { name: "أحمد محمد العتيبي", halaqa: 0 },
  { name: "سليمان خالد الرشيد", halaqa: 0 },
  { name: "عبدالله فهد القحطاني", halaqa: 0 },
  { name: "ياسر منصور الحارثي", halaqa: 1 },
  { name: "فيصل عبدالعزيز المطيري", halaqa: 1 },
  { name: "محمد عبد الرحمن", halaqa: 1 },
  { name: "يوسف خالد", halaqa: 2 },
  { name: "عبد الله حسن", halaqa: 2 },
  { name: "عمر فاروق", halaqa: 3 },
  { name: "زيد خالد", halaqa: 3 },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

tx(() => {
  // تنظيف
  db.exec(`
    DELETE FROM point_transactions;
    DELETE FROM recitations;
    DELETE FROM attendance_entries;
    DELETE FROM attendance_sessions;
    DELETE FROM students;
    DELETE FROM halaqat;
    DELETE FROM otp_codes;
    DELETE FROM teacher_halaqat;
    DELETE FROM users;
  `);

  // المعرّفات لا تُعاد بعد الحذف (AUTOINCREMENT)، لذا نحتفظ بالمعرّفات الفعلية بعد الإدخال
  const insertUser = db.prepare(
    `INSERT INTO users (name, username, password_hash, phone_number, country_code, role)
     VALUES (?, ?, ?, ?, '963', ?)`
  );
  const userIds = teachers.map((t) =>
    Number(
      insertUser.run(t.name, t.username, hashPassword(t.password), t.phone, t.role).lastInsertRowid
    )
  );
  const adminId = userIds[teachers.findIndex((t) => t.role === "ADMIN")];

  const insertHalaqa = db.prepare(
    "INSERT INTO halaqat (name, teacher_id, schedule_time) VALUES (?, ?, ?)"
  );
  const halaqaIds = halaqat.map((h) =>
    Number(insertHalaqa.run(h.name, userIds[h.teacher], h.time).lastInsertRowid)
  );

  // إسناد صريح: كل مدرّس إلى حلقته. الأستاذ الأول يُسند لحلقتين لاختبار التعدّد.
  const assign = db.prepare(
    "INSERT OR IGNORE INTO teacher_halaqat (user_id, halaqa_id) VALUES (?, ?)"
  );
  halaqat.forEach((h, index) => assign.run(userIds[h.teacher], halaqaIds[index]));

  const insertStudent = db.prepare(
    "INSERT INTO students (code, name, halaqa_id, parent_phone) VALUES (?, ?, ?, ?)"
  );
  students.forEach((s, i) => {
    insertStudent.run(
      `2024${String(i + 1).padStart(3, "0")}`,
      s.name,
      halaqaIds[s.halaqa],
      "0930000000"
    );
  });

  const studentRows = db.prepare("SELECT id, halaqa_id AS halaqaId FROM students").all() as {
    id: number;
    halaqaId: number;
  }[];

  // حضور لآخر خمسة أيام
  const insertSession = db.prepare(
    `INSERT INTO attendance_sessions (halaqa_id, date, teacher_status, recorded_by)
     VALUES (?, ?, ?, ?)`
  );
  const insertEntry = db.prepare(
    "INSERT INTO attendance_entries (session_id, student_id, status) VALUES (?, ?, ?)"
  );

  for (let day = 5; day >= 1; day--) {
    const date = daysAgo(day);
    for (const [index, h] of halaqaIds.entries()) {
      const info = insertSession.run(
        h,
        date,
        day === 3 && index === 1 ? "absent" : "present",
        adminId
      );
      const sessionId = Number(info.lastInsertRowid);

      for (const s of studentRows.filter((s) => s.halaqaId === h)) {
        const status = (s.id + day) % 5 === 0 ? "absent" : "present";
        insertEntry.run(sessionId, s.id, status);
        if (status === "present") {
          addPoints({
            studentId: s.id,
            delta: config.pointRules.attendancePresent,
            reason: `حضور ${date}`,
            kind: "attendance",
            referenceId: sessionId,
            createdBy: adminId,
          });
        }
      }
    }
  }

  // تلاوات
  const insertRecitation = db.prepare(
    `INSERT INTO recitations
       (student_id, halaqa_id, type, page_number, to_page, verse, page_completed, rating, notes, recited_at, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const ratings = ["excellent", "good", "needs"] as const;

  studentRows.forEach((s, i) => {
    for (let k = 0; k < 3; k++) {
      const rating = ratings[(i + k) % 3];
      const page = 10 + i * 4 + k;
      const info = insertRecitation.run(
        s.id,
        s.halaqaId,
        "full",
        page,
        null,
        null,
        1,
        rating,
        k === 0 ? "أداء جيد مع مراعاة أحكام التجويد" : null,
        daysAgo(k + 1),
        adminId
      );
      addPoints({
        studentId: s.id,
        delta: config.pointRules.recitation[rating],
        reason: `تسميع صفحة ${page}`,
        kind: "recitation",
        referenceId: Number(info.lastInsertRowid),
        createdBy: adminId,
      });
    }
  });
});

const counts = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM halaqat) AS halaqat,
            (SELECT COUNT(*) FROM students) AS students,
            (SELECT COUNT(*) FROM attendance_sessions) AS sessions,
            (SELECT COUNT(*) FROM recitations) AS recitations`
  )
  .get();

console.log("✔ تم إدخال البيانات التجريبية:", counts);
console.log('  الدخول: "عمار شهوري" (مشرف) أو "أيهم شعرية" (مدرّس) — كلمة المرور: 123');
