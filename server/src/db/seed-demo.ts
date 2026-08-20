/**
 * بيانات النسخة التجريبية (Demo) — لعرض المشروع في المعرض وأمام الـ HR.
 *
 * التشغيل: npm run db:seed-demo   (من جذر المشروع أو من مجلد server)
 *
 * تختلف عن seed.ts في أنها تبني قاعدة "حيّة" المظهر: ثلاث حلقات بمراحلها،
 * خمسة عشر طالباً، وستون يوماً من الحضور والتسميع والنقاط بتواريخ ماضية
 * حقيقية — فتظهر لوحة الصدارة والتقارير والرسوم ممتلئة بدل أن تكون فارغة.
 *
 * كل السجلات تُدخَل بتاريخ created_at صريح في الماضي (لا نستعمل addPoints
 * لأنها تعتمد على datetime('now')، فتنهار فلاتر الفترات في صفحة التقارير).
 *
 * التوليد حتميّ (مولّد أرقام شبه عشوائي ببذرة ثابتة): كل تشغيل يعطي نفس
 * البيانات، فتبقى لقطات الشاشة في المعرض مطابقة لما يراه الزائر.
 *
 * تحذير: يمسح كل محتوى القاعدة قبل الإدخال. لا يُشغَّل على قاعدة المسجد
 * الحقيقية — وجّهه إلى ملف منفصل عبر DB_FILE (انظر .env.example).
 */
import { config } from "../config.js";
import { db, migrate, tx } from "./index.js";
import { hashPassword } from "../lib/password.js";
import { recitationPoints } from "../services/points.js";
import { JUZ_AMMA } from "../lib/juzAmma.js";

migrate();

// ── مولّد عشوائي ببذرة ثابتة (mulberry32) ─────────────────────────────
let seedState = 0x9e3779b9;
function rand(): number {
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** عدد صحيح في [min, max] شاملاً الطرفين. */
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
/** عنصر من مصفوفة. */
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
/** صحيح باحتمال p. */
const chance = (p: number) => rand() < p;

// ── التواريخ ──────────────────────────────────────────────────────────
/** عدد الأيام الماضية التي تُولَّد لها سجلات. */
const HISTORY_DAYS = 60;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/** YYYY-MM-DD بالتوقيت المحلي (toISOString يزيح اليوم حسب المنطقة الزمنية). */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** YYYY-MM-DD HH:MM:SS — نفس صيغة datetime('now') في SQLite. */
function isoStamp(d: Date, hour: number, minute: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${isoDate(d)} ${pad(hour)}:${pad(minute)}:${pad(randInt(0, 59))}`;
}

// ── الكادر ────────────────────────────────────────────────────────────
/**
 * حسابات وهمية بالكامل. أسماء الدخول لاتينية قصيرة (demo_admin) لتُكتب
 * بسهولة أمام الزائر دون تبديل لغة لوحة المفاتيح، والاسم المعروض عربيّ
 * لأن الواجهة عربية. كلمة المرور واحدة للجميع تبسيطاً للعرض.
 */
const DEMO_PASSWORD = "123456";

const staff = [
  { name: "المدير التجريبي", username: "demo_admin", phone: "900000001", role: "ADMIN" },
  { name: "المشرف التجريبي", username: "demo_supervisor", phone: "900000002", role: "SUPERVISOR" },
  { name: "الأستاذ التجريبي", username: "demo_teacher", phone: "900000003", role: "TEACHER" },
  { name: "أ. سامي نبيل", username: "demo_teacher2", phone: "900000004", role: "TEACHER" },
  { name: "أ. كريم منصور", username: "demo_teacher3", phone: "900000005", role: "TEACHER" },
] as const;

const ADMIN = 0;
const TEACHER_DEMO = 2;

/** teacher = فهرس الأستاذ في staff. */
const halaqat = [
  { name: "حلقة الفرقان", teacher: TEACHER_DEMO, stage: "primary", time: "16:00", location: "القاعة الأولى" },
  { name: "حلقة النور", teacher: 3, stage: "preparatory", time: "17:30", location: "القاعة الثانية" },
  { name: "حلقة الهدى", teacher: 4, stage: "secondary", time: "19:00", location: "المصلى الرئيسي" },
] as const;

/**
 * level يحدّد سلوك الطالب في التوليد:
 *   strong = مواظب ومتقن، mid = متوسط، weak = كثير الغياب وتقييمه أدنى.
 * وجود المستويات الثلاثة هو ما يجعل لوحة الصدارة والتقارير ذات معنى.
 */
type Level = "strong" | "mid" | "weak";

const students: { name: string; halaqa: number; level: Level; birth: string }[] = [
  // حلقة الفرقان — ابتدائي
  { name: "محمد أحمد", halaqa: 0, level: "strong", birth: "2014-03-12" },
  { name: "خالد عمر", halaqa: 0, level: "strong", birth: "2014-07-02" },
  { name: "يوسف علي", halaqa: 0, level: "mid", birth: "2015-01-19" },
  { name: "سعيد كمال", halaqa: 0, level: "mid", birth: "2014-11-05" },
  { name: "بلال رياض", halaqa: 0, level: "weak", birth: "2015-05-23" },

  // حلقة النور — إعدادي
  { name: "أنس فادي", halaqa: 1, level: "strong", birth: "2011-04-14" },
  { name: "عمر سليم", halaqa: 1, level: "mid", birth: "2011-08-08" },
  { name: "زياد ماهر", halaqa: 1, level: "strong", birth: "2012-02-27" },
  { name: "رامي سمير", halaqa: 1, level: "weak", birth: "2011-12-01" },
  { name: "ليث جمال", halaqa: 1, level: "mid", birth: "2012-06-16" },

  // حلقة الهدى — ثانوي
  { name: "طه إبراهيم", halaqa: 2, level: "strong", birth: "2008-05-09" },
  { name: "حسن وائل", halaqa: 2, level: "mid", birth: "2008-09-13" },
  { name: "مروان عادل", halaqa: 2, level: "strong", birth: "2009-01-25" },
  { name: "فارس نديم", halaqa: 2, level: "weak", birth: "2008-11-11" },
  { name: "إياد شريف", halaqa: 2, level: "mid", birth: "2009-03-07" },
];

/** احتمال الحضور، ونسبة التأخير، واحتمالات التقييم لكل مستوى. */
const PROFILE: Record<Level, { attend: number; late: number; excellent: number; good: number }> = {
  strong: { attend: 0.95, late: 0.04, excellent: 0.65, good: 0.3 },
  mid: { attend: 0.85, late: 0.1, excellent: 0.35, good: 0.45 },
  weak: { attend: 0.66, late: 0.14, excellent: 0.12, good: 0.4 },
};

/** احتمال أن يسمّع الطالب في يوم حضره. */
const RECITE_CHANCE: Record<Level, number> = { strong: 0.8, mid: 0.6, weak: 0.4 };

const RECITATION_NOTES = [
  "أداء ممتاز مع إتقان أحكام التجويد",
  "حفظ متين، يُنصح بمراجعة المدود",
  "يحتاج تركيزاً أكبر على الغنّة",
  "تحسّن ملحوظ عن الأسبوع الماضي",
  "مراجعة جيدة والمخارج سليمة",
];

/** مكافآت وخصومات يدوية — تُظهر سجل النقاط بأسبابه في ملف الطالب. */
const BONUSES = [
  { reason: "مسابقة الحفظ الأسبوعية — المركز الأول", delta: 50 },
  { reason: "مساعدة زملائه في المراجعة", delta: 20 },
  { reason: "المواظبة على صلاة الفجر في المسجد", delta: 30 },
  { reason: "إتقان مراجعة جزء عمّ كاملاً", delta: 40 },
];
const PENALTIES = [
  { reason: "إزعاج أثناء الحلقة", delta: -15 },
  { reason: "عدم إحضار المصحف", delta: -10 },
  { reason: "تأخر متكرر دون عذر", delta: -20 },
];

// ── الإدخال ───────────────────────────────────────────────────────────
tx(() => {
  db.exec(`
    DELETE FROM point_transactions;
    DELETE FROM recitations;
    DELETE FROM attendance_entries;
    DELETE FROM attendance_sessions;
    DELETE FROM students;
    DELETE FROM teacher_halaqat;
    DELETE FROM halaqat;
    DELETE FROM otp_codes;
    DELETE FROM users;
  `);

  const createdAt = isoStamp(daysAgo(HISTORY_DAYS + 5), 9, 0);

  const insertUser = db.prepare(
    `INSERT INTO users (name, username, password_hash, phone_number, country_code, role, created_at)
     VALUES (?, ?, ?, ?, '963', ?, ?)`
  );
  const userIds = staff.map((s) =>
    Number(
      insertUser.run(s.name, s.username, hashPassword(DEMO_PASSWORD), s.phone, s.role, createdAt)
        .lastInsertRowid
    )
  );
  const adminId = userIds[ADMIN];

  const insertHalaqa = db.prepare(
    `INSERT INTO halaqat (name, teacher_id, stage, schedule_time, location, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const halaqaIds = halaqat.map((h) =>
    Number(
      insertHalaqa.run(h.name, userIds[h.teacher], h.stage, h.time, h.location, createdAt)
        .lastInsertRowid
    )
  );

  const assign = db.prepare(
    "INSERT OR IGNORE INTO teacher_halaqat (user_id, halaqa_id) VALUES (?, ?)"
  );
  halaqat.forEach((h, i) => assign.run(userIds[h.teacher], halaqaIds[i]));
  // المشرف يرى كل الحلقات بحكم دوره. نُسند حساب الأستاذ التجريبي إلى حلقة ثانية
  // أيضاً ليُظهر العرض حالة الأستاذ متعدّد الحلقات وتبديل الحلقة في الشريط.
  assign.run(userIds[TEACHER_DEMO], halaqaIds[1]);

  const insertStudent = db.prepare(
    `INSERT INTO students (code, name, halaqa_id, birth_date, parent_phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  students.forEach((s, i) => {
    insertStudent.run(
      `2024${String(i + 1).padStart(3, "0")}`,
      s.name,
      halaqaIds[s.halaqa],
      s.birth,
      `09${String(30000000 + i * 137).padStart(8, "0")}`,
      createdAt
    );
  });

  const studentRows = db
    .prepare("SELECT id, halaqa_id AS halaqaId FROM students ORDER BY id")
    .all() as { id: number; halaqaId: number }[];
  const levelOf = new Map(studentRows.map((row, i) => [row.id, students[i].level]));

  // النقاط: نُدخل الحركة ونجمّع الرصيد في الذاكرة ثم نكتبه دفعة واحدة في
  // النهاية — أسرع بكثير من UPDATE لكل حركة عبر آلاف السجلات.
  const insertPoint = db.prepare(
    `INSERT INTO point_transactions
       (student_id, delta, reason, kind, reference_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const balances = new Map<number, number>(studentRows.map((s) => [s.id, 0]));

  function award(
    studentId: number,
    delta: number,
    reason: string,
    kind: "manual" | "attendance" | "recitation" | "adjustment",
    referenceId: number | null,
    at: string
  ): void {
    insertPoint.run(studentId, delta, reason, kind, referenceId, adminId, at);
    balances.set(studentId, (balances.get(studentId) ?? 0) + delta);
  }

  // ── الحضور: كل يوم عدا الجمعة، لآخر HISTORY_DAYS يوماً ──────────────
  const insertSession = db.prepare(
    `INSERT INTO attendance_sessions
       (halaqa_id, date, teacher_status, notes, recorded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertEntry = db.prepare(
    "INSERT INTO attendance_entries (session_id, student_id, status) VALUES (?, ?, ?)"
  );

  let sessionCount = 0;

  for (let day = HISTORY_DAYS; day >= 0; day--) {
    const date = daysAgo(day);
    if (date.getDay() === 5) continue; // الجمعة عطلة

    for (const [index, halaqaId] of halaqaIds.entries()) {
      // غياب نادر للأستاذ نفسه — يجعل تقرير الكادر غير مثالي عمداً
      const teacherAbsent = chance(0.04);
      const stamp = isoStamp(date, 16 + index, randInt(5, 40));

      const sessionId = Number(
        insertSession.run(
          halaqaId,
          isoDate(date),
          teacherAbsent ? "absent" : "present",
          teacherAbsent ? "أُسندت الحلقة إلى أستاذ بديل" : null,
          adminId,
          stamp,
          stamp
        ).lastInsertRowid
      );
      sessionCount++;

      for (const s of studentRows.filter((r) => r.halaqaId === halaqaId)) {
        const p = PROFILE[levelOf.get(s.id)!];

        let status: "present" | "late" | "absent" | "excused";
        if (chance(p.attend)) status = chance(p.late) ? "late" : "present";
        else status = chance(0.3) ? "excused" : "absent";

        insertEntry.run(sessionId, s.id, status);

        if (status === "present" || status === "late") {
          // المتأخر ينال نصف نقاط الحضور
          const delta = Math.round(
            config.pointRules.attendancePresent * (status === "late" ? 0.5 : 1)
          );
          award(s.id, delta, `حضور ${isoDate(date)}`, "attendance", sessionId, stamp);
        }
      }
    }
  }

  // ── التسميع: في معظم أيام الحضور ────────────────────────────────────
  const insertRecitation = db.prepare(
    `INSERT INTO recitations
       (student_id, halaqa_id, type, page_number, to_page, verse, page_completed,
        surah_number, rating, notes, recited_at, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // كل طالب يتقدّم في المصحف من صفحة بداية خاصة به، فتبدو سجلاته متسلسلة
  const progress = new Map(studentRows.map((s, i) => [s.id, 582 + (i % 8) * 2]));
  let recitationCount = 0;

  const attended = db
    .prepare(
      `SELECT e.student_id AS studentId, a.date, a.halaqa_id AS halaqaId
       FROM attendance_entries e
       JOIN attendance_sessions a ON a.id = e.session_id
       WHERE e.status IN ('present', 'late')
       ORDER BY a.date, e.student_id`
    )
    .all() as { studentId: number; date: string; halaqaId: number }[];

  for (const row of attended) {
    const level = levelOf.get(row.studentId)!;
    const p = PROFILE[level];

    if (!chance(RECITE_CHANCE[level])) continue; // ليس كل حضور يعني تسميعاً

    // الاحتمال الثاني مشروط بعدم وقوع الأول، فنقسمه على المتبقي حتى تبقى
    // النسب النهائية مطابقة لما في PROFILE.
    const rating = chance(p.excellent)
      ? "excellent"
      : chance(p.good / (1 - p.excellent))
        ? "good"
        : "needs";

    // مزيج من الأنواع الأربعة ليُظهر العرض كل مسارات التسميع في الواجهة
    const roll = rand();
    const current = progress.get(row.studentId)!;

    let type: "full" | "half" | "more" | "surah";
    let pageNumber: number;
    let toPage: number | null = null;
    let verse: number | null = null;
    let pageCompleted = 0;
    let surahNumber: number | null = null;

    if (roll < 0.25) {
      const surah = pick(JUZ_AMMA);
      type = "surah";
      surahNumber = surah.number;
      pageNumber = surah.startPage;
      toPage = surah.endPage > surah.startPage ? surah.endPage : null;
    } else if (roll < 0.45) {
      type = "half";
      pageNumber = current;
      verse = randInt(3, 18);
      pageCompleted = chance(0.5) ? 1 : 0;
      if (pageCompleted) progress.set(row.studentId, current + 1);
    } else if (roll < 0.6 && level === "strong") {
      type = "more";
      pageNumber = current;
      toPage = current + randInt(1, 2);
      progress.set(row.studentId, toPage + 1);
    } else {
      type = "full";
      pageNumber = current;
      progress.set(row.studentId, current + 1);
    }

    // لا نتجاوز نهاية المصحف: نعود إلى بداية جزء عمّ
    if (progress.get(row.studentId)! > 604) progress.set(row.studentId, 582);

    const stamp = `${row.date} 17:${String(randInt(0, 55)).padStart(2, "0")}:${String(
      randInt(0, 59)
    ).padStart(2, "0")}`;

    const recitationId = Number(
      insertRecitation.run(
        row.studentId,
        row.halaqaId,
        type,
        pageNumber,
        toPage,
        verse,
        pageCompleted,
        surahNumber,
        rating,
        chance(0.35) ? pick(RECITATION_NOTES) : null,
        row.date,
        adminId,
        stamp
      ).lastInsertRowid
    );
    recitationCount++;

    // نستعمل دالة الخادم نفسها لحساب النقاط، فتطابق بيانات العرض ما ينتجه
    // التطبيق حين يسجّل المستخدم تسميعاً جديداً أمام الزائر.
    const delta = recitationPoints({ rating, type, pageNumber, toPage, surahNumber });
    const label = type === "surah" ? `سورة ${surahNumber}` : `صفحة ${pageNumber}`;
    award(row.studentId, delta, `تسميع ${label}`, "recitation", recitationId, stamp);
  }

  // ── مكافآت وخصومات يدوية ────────────────────────────────────────────
  let manualCount = 0;

  for (const s of studentRows) {
    for (let i = 0; i < randInt(1, 3); i++) {
      const bonus = pick(BONUSES);
      award(s.id, bonus.delta, bonus.reason, "manual", null, isoStamp(daysAgo(randInt(1, HISTORY_DAYS)), 18, randInt(0, 59)));
      manualCount++;
    }

    if (levelOf.get(s.id) !== "strong" && chance(0.6)) {
      const penalty = pick(PENALTIES);
      award(s.id, penalty.delta, penalty.reason, "manual", null, isoStamp(daysAgo(randInt(1, HISTORY_DAYS)), 18, randInt(0, 59)));
      manualCount++;
    }
  }

  // كتابة الأرصدة النهائية
  const setPoints = db.prepare("UPDATE students SET points = ? WHERE id = ?");
  for (const [studentId, total] of balances) setPoints.run(total, studentId);

  console.log(
    `  جلسات حضور: ${sessionCount} | تسميعات: ${recitationCount} | حركات نقاط يدوية: ${manualCount}`
  );
});

const counts = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM halaqat) AS halaqat,
            (SELECT COUNT(*) FROM students) AS students,
            (SELECT COUNT(*) FROM attendance_sessions) AS sessions,
            (SELECT COUNT(*) FROM attendance_entries) AS entries,
            (SELECT COUNT(*) FROM recitations) AS recitations,
            (SELECT COUNT(*) FROM point_transactions) AS points`
  )
  .get();

const top = db
  .prepare("SELECT name, points FROM students ORDER BY points DESC LIMIT 3")
  .all() as { name: string; points: number }[];

console.log("\n✔ تم تجهيز بيانات النسخة التجريبية:", counts);
console.log(`  القاعدة: ${config.dbFile}`);
console.log(`  الصدارة: ${top.map((t, i) => `${i + 1}. ${t.name} (${t.points})`).join("  |  ")}`);

// الحسابات تُطبع من نفس المصفوفة التي أُدخلت منها، فلا تفترق الطباعة عن
// الواقع إن عُدّلت الأسماء لاحقاً.
console.log("\n  ──────── حسابات الدخول التجريبية ────────");
const roleLabel: Record<string, string> = {
  ADMIN: "مدير ",
  SUPERVISOR: "مشرف ",
  TEACHER: "أستاذ",
};
for (const s of staff) {
  console.log(`    ${roleLabel[s.role]} | ${s.username.padEnd(16)} | ${DEMO_PASSWORD}  (${s.name})`);
}
console.log("  ─────────────────────────────────────────");
