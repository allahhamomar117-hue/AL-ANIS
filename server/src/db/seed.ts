/**
 * بيانات تجريبية مطابقة للأسماء المستخدمة حالياً في الواجهات.
 * التشغيل: npm run db:seed
 */
import { config } from "../config.js";
import { closeDb, db, migrate, tx } from "./index.js";
import { addPoints } from "../services/points.js";
import { hashPassword } from "../lib/password.js";

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

async function main(): Promise<void> {
  await migrate();

  await tx(async () => {
    // تنظيف. الترتيب يحترم المفاتيح الأجنبية، وينفَّذ أمراً أمراً لأن
    // Postgres لا يقبل عدّة عبارات في استعلام واحد ذي معاملات.
    for (const table of [
      "point_transactions",
      "recitations",
      "attendance_entries",
      "attendance_sessions",
      "students",
      "halaqat",
      "otp_codes",
      "teacher_halaqat",
      "users",
    ]) {
      await db().run(`DELETE FROM ${table}`);
    }

    // المعرّفات لا تُعاد بعد الحذف، لذا نحتفظ بالمعرّفات الفعلية بعد الإدخال
    const userIds: number[] = [];
    for (const t of teachers) {
      const info = await db().run(
        `INSERT INTO users (name, username, password_hash, phone_number, country_code, role)
         VALUES (?, ?, ?, ?, '963', ?)`,
        [t.name, t.username, hashPassword(t.password), t.phone, t.role]
      );
      userIds.push(info.lastInsertRowid);
    }
    const adminId = userIds[teachers.findIndex((t) => t.role === "ADMIN")];

    const halaqaIds: number[] = [];
    for (const h of halaqat) {
      const info = await db().run(
        "INSERT INTO halaqat (name, teacher_id, schedule_time) VALUES (?, ?, ?)",
        [h.name, userIds[h.teacher], h.time]
      );
      halaqaIds.push(info.lastInsertRowid);
    }

    // إسناد صريح: كل مدرّس إلى حلقته.
    for (const [index, h] of halaqat.entries()) {
      await db().run(
        `INSERT INTO teacher_halaqat (user_id, halaqa_id) VALUES (?, ?)
         ON CONFLICT (user_id, halaqa_id) DO NOTHING`,
        [userIds[h.teacher], halaqaIds[index]]
      );
    }

    for (const [i, s] of students.entries()) {
      await db().run(
        "INSERT INTO students (code, name, halaqa_id, parent_phone) VALUES (?, ?, ?, ?)",
        [`2024${String(i + 1).padStart(3, "0")}`, s.name, halaqaIds[s.halaqa], "0930000000"]
      );
    }

    const studentRows = await db().all<{ id: number; halaqaId: number }>(
      `SELECT id, halaqa_id AS "halaqaId" FROM students`
    );

    // حضور لآخر خمسة أيام
    for (let day = 5; day >= 1; day--) {
      const date = daysAgo(day);
      for (const [index, h] of halaqaIds.entries()) {
        const info = await db().run(
          `INSERT INTO attendance_sessions (halaqa_id, date, teacher_status, recorded_by)
           VALUES (?, ?, ?, ?)`,
          [h, date, day === 3 && index === 1 ? "absent" : "present", adminId]
        );
        const sessionId = info.lastInsertRowid;

        for (const s of studentRows.filter((s) => s.halaqaId === h)) {
          const status = (s.id + day) % 5 === 0 ? "absent" : "present";
          await db().run(
            "INSERT INTO attendance_entries (session_id, student_id, status) VALUES (?, ?, ?)",
            [sessionId, s.id, status]
          );
          if (status === "present") {
            await addPoints({
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
    const ratings = ["excellent", "good", "needs"] as const;

    for (const [i, s] of studentRows.entries()) {
      for (let k = 0; k < 3; k++) {
        const rating = ratings[(i + k) % 3];
        const page = 10 + i * 4 + k;
        const info = await db().run(
          `INSERT INTO recitations
             (student_id, halaqa_id, type, page_number, to_page, verse, page_completed, rating, notes, recited_at, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.halaqaId,
            "full",
            page,
            null,
            null,
            // منطقيّ صريح: عمود Postgres من نوع boolean لا يقبل 1
            true,
            rating,
            k === 0 ? "أداء جيد مع مراعاة أحكام التجويد" : null,
            daysAgo(k + 1),
            adminId,
          ]
        );
        await addPoints({
          studentId: s.id,
          delta: config.pointRules.recitation[rating],
          reason: `تسميع صفحة ${page}`,
          kind: "recitation",
          referenceId: info.lastInsertRowid,
          createdBy: adminId,
        });
      }
    }
  });

  const counts = await db().get(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM halaqat) AS halaqat,
            (SELECT COUNT(*) FROM students) AS students,
            (SELECT COUNT(*) FROM attendance_sessions) AS sessions,
            (SELECT COUNT(*) FROM recitations) AS recitations`
  );

  console.log("✔ تم إدخال البيانات التجريبية:", counts);
  console.log('  الدخول: "عمار شهوري" (مشرف) أو "أيهم شعرية" (مدرّس) — كلمة المرور: 123');

  await closeDb();
}

main().catch((error) => {
  console.error("✖ فشل إدخال البيانات:", error);
  process.exit(1);
});
