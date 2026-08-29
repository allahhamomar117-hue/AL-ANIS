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
import { pathToFileURL } from "node:url";
import { config } from "../config.js";
import { db, migrate, tx } from "./index.js";
import { hashPassword } from "../lib/password.js";
import { recitationPoints } from "../services/points.js";
import { JUZ_AMMA } from "../lib/surahs.js";


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

/**
 * الكادر: مدير ومشرف وعشرة أساتذة، أستاذ لكل حلقة.
 *
 * أسماء الدخول الثلاثة الأولى ثابتة (demo_admin / demo_supervisor /
 * demo_teacher) لأنها المطبوعة على بطاقة العرض؛ ما بعدها مُولَّد بالترقيم.
 */
const TEACHER_NAMES = [
  "الأستاذ التجريبي",
  "أ. سامي نبيل",
  "أ. كريم منصور",
  "أ. بلال الخطيب",
  "أ. ياسين محمود",
  "أ. أنس الحمصي",
  "أ. مهند القاسم",
  "أ. وائل الشامي",
  "أ. طارق الحلبي",
  "أ. حازم الدرويش",
];

const staff = [
  { name: "المدير التجريبي", username: "demo_admin", phone: "900000001", role: "ADMIN" },
  { name: "المشرف التجريبي", username: "demo_supervisor", phone: "900000002", role: "SUPERVISOR" },
  ...TEACHER_NAMES.map((name, i) => ({
    name,
    username: i === 0 ? "demo_teacher" : `demo_teacher${i + 1}`,
    phone: `9000000${String(i + 3).padStart(2, "0")}`,
    role: "TEACHER" as const,
  })),
];

const ADMIN = 0;
/** فهرس أوّل أستاذ في staff — بعد المدير والمشرف. */
const FIRST_TEACHER = 2;

/**
 * عشر حلقات موزّعة على المراحل الثلاث، أستاذ لكل واحدة.
 * teacher = فهرس الأستاذ في staff.
 */
const HALAQA_NAMES = [
  { name: "حلقة الفرقان", stage: "primary", location: "القاعة الأولى" },
  { name: "حلقة النور", stage: "primary", location: "القاعة الثانية" },
  { name: "حلقة الهدى", stage: "primary", location: "القاعة الثالثة" },
  { name: "حلقة البيان", stage: "preparatory", location: "القاعة الرابعة" },
  { name: "حلقة التقوى", stage: "preparatory", location: "قاعة المكتبة" },
  { name: "حلقة الإخلاص", stage: "preparatory", location: "القاعة الشرقية" },
  { name: "حلقة الرحمن", stage: "secondary", location: "المصلى الرئيسي" },
  { name: "حلقة المصابيح", stage: "secondary", location: "المصلى العلوي" },
  { name: "حلقة السكينة", stage: "secondary", location: "القاعة الغربية" },
  { name: "حلقة الميزان", stage: "secondary", location: "قاعة المحاضرات" },
];

/** أوقات دورية: ثلاث فترات تتناوب عليها الحلقات. */
const HALAQA_TIMES = ["16:00", "17:30", "19:00"];

const halaqat = HALAQA_NAMES.map((h, i) => ({
  name: h.name,
  teacher: FIRST_TEACHER + i,
  stage: h.stage,
  time: HALAQA_TIMES[i % HALAQA_TIMES.length],
  location: h.location,
}));

/**
 * level يحدّد سلوك الطالب في التوليد:
 *   strong = مواظب ومتقن، mid = متوسط، weak = كثير الغياب وتقييمه أدنى.
 * وجود المستويات الثلاثة هو ما يجعل لوحة الصدارة والتقارير ذات معنى.
 */
type Level = "strong" | "mid" | "weak";

/**
 * خمسون طالباً: خمسة لكل حلقة.
 *
 * الأسماء تُركَّب من مجموعتَي الاسم واللقب بحسابٍ على الفهرس لا بعشوائية،
 * فيبقى اسم الطالب رقم 17 هو نفسه في كل تشغيل حتى لو تغيّر ترتيب التوليد
 * لاحقاً — وهذا ما يُبقي لقطات المعرض مطابقة.
 */
const FIRST_NAMES = [
  "محمد", "أحمد", "خالد", "عمر", "يوسف", "سعيد", "بلال", "أنس", "زياد", "رامي",
  "ليث", "طه", "حسن", "مروان", "فارس", "إياد", "كريم", "سامي", "نادر", "وسيم",
  "عبد الله", "عبد الرحمن", "مصعب", "حمزة", "أسامة",
];
const FAMILY_NAMES = [
  "الحلبي", "الدمشقي", "الشامي", "القاسم", "النعيمي", "الحمصي", "الخطيب", "السبّاغ",
  "الأنصاري", "الجابري",
];

/** المرحلة تحدّد سنة الميلاد التقريبية، فتبدو الأعمار متسقة مع حلقاتها. */
const BIRTH_YEAR: Record<string, number> = {
  primary: 2015,
  preparatory: 2012,
  secondary: 2009,
};

const LEVEL_CYCLE: Level[] = ["strong", "mid", "strong", "weak", "mid"];

const students: { name: string; halaqa: number; level: Level; birth: string }[] = Array.from(
  { length: halaqat.length * 5 },
  (_, i) => {
    const halaqa = Math.floor(i / 5);
    const stage = halaqat[halaqa].stage;
    const year = BIRTH_YEAR[stage] + (i % 2);
    const month = (i % 12) + 1;
    const day = ((i * 7) % 27) + 1;

    return {
      name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${
        FAMILY_NAMES[(i * 3) % FAMILY_NAMES.length]
      }`,
      halaqa,
      level: LEVEL_CYCLE[i % LEVEL_CYCLE.length],
      birth: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }
);

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
/**
 * يبني بيانات العرض من الصفر. يمسح كل محتوى القاعدة الحالية أولاً، لذا
 * يُوجَّه دائماً إلى ملف منفصل عبر DB_FILE (انظر .env.example).
 *
 * مُصدَّرة كدالة لأن الخادم يستدعيها عند الإقلاع على منصّات القرص المؤقّت
 * (Railway) حيث لا يبقى ملف القاعدة بين عمليات النشر.
 */
export async function seedDemo(): Promise<void> {
  await migrate();

  await tx(async () => {
    // الترتيب يحترم المفاتيح الأجنبية، وينفَّذ أمراً أمراً لأن Postgres
    // لا يقبل عدّة عبارات في استعلام واحد.
    for (const table of [
      "point_transactions",
      "recitations",
      "attendance_entries",
      "attendance_sessions",
      "students",
      "teacher_halaqat",
      "halaqat",
      "otp_codes",
      "users",
    ]) {
      await db().run(`DELETE FROM ${table}`);
    }

    const createdAt = isoStamp(daysAgo(HISTORY_DAYS + 5), 9, 0);

    const userIds: number[] = [];
    for (const s of staff) {
      const info = await db().run(
        `INSERT INTO users (name, username, password_hash, phone_number, country_code, role, created_at)
         VALUES (?, ?, ?, ?, '963', ?, ?)`,
        [s.name, s.username, hashPassword(DEMO_PASSWORD), s.phone, s.role, createdAt]
      );
      userIds.push(info.lastInsertRowid);
    }
    const adminId = userIds[ADMIN];

    const halaqaIds: number[] = [];
    for (const h of halaqat) {
      const info = await db().run(
        `INSERT INTO halaqat (name, teacher_id, stage, schedule_time, location, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [h.name, userIds[h.teacher], h.stage, h.time, h.location, createdAt]
      );
      halaqaIds.push(info.lastInsertRowid);
    }

    const assign = (userId: number, halaqaId: number) =>
      db().run(
        `INSERT INTO teacher_halaqat (user_id, halaqa_id) VALUES (?, ?)
         ON CONFLICT (user_id, halaqa_id) DO NOTHING`,
        [userId, halaqaId]
      );

    /*
     * حلقة واحدة لكل أستاذ، بلا استثناء.
     *
     * كان حساب الأستاذ التجريبي يُسنَد إلى حلقة ثانية لإظهار حالة تعدّد
     * الحلقات؛ أُلغي تبسيطاً لنسخة العرض حتى لا يظهر مبدّل الحلقات في
     * الشريط. المشرف يبقى يرى الجميع بحكم دوره لا بالإسناد.
     *
     * halaqat[i].teacher فريد بالبناء (‏FIRST_TEACHER + i)، فالحلقة الواحدة
     * لكل أستاذ مضمونة من هنا.
     */
    for (const [i, h] of halaqat.entries()) await assign(userIds[h.teacher], halaqaIds[i]);

    for (const [i, s] of students.entries()) {
      await db().run(
        `INSERT INTO students (code, name, halaqa_id, birth_date, parent_phone, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `2024${String(i + 1).padStart(3, "0")}`,
          s.name,
          halaqaIds[s.halaqa],
          s.birth,
          `09${String(30000000 + i * 137).padStart(8, "0")}`,
          createdAt,
        ]
      );
    }

    const studentRows = await db().all<{ id: number; halaqaId: number }>(
      `SELECT id, halaqa_id AS "halaqaId" FROM students ORDER BY id`
    );
    const levelOf = new Map(studentRows.map((row, i) => [row.id, students[i].level]));

    // النقاط: نُدخل الحركة ونجمّع الرصيد في الذاكرة ثم نكتبه دفعة واحدة في
    // النهاية — أسرع بكثير من UPDATE لكل حركة عبر آلاف السجلات.
    const balances = new Map<number, number>(studentRows.map((s) => [s.id, 0]));

    async function award(
      studentId: number,
      delta: number,
      reason: string,
      kind: "manual" | "attendance" | "recitation" | "adjustment",
      referenceId: number | null,
      at: string
    ): Promise<void> {
      await db().run(
        `INSERT INTO point_transactions
           (student_id, delta, reason, kind, reference_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [studentId, delta, reason, kind, referenceId, adminId, at]
      );
      balances.set(studentId, (balances.get(studentId) ?? 0) + delta);
    }

    // ── الحضور: كل يوم عدا الجمعة، لآخر HISTORY_DAYS يوماً ──────────────
    let sessionCount = 0;

    for (let day = HISTORY_DAYS; day >= 0; day--) {
      const date = daysAgo(day);
      if (date.getDay() === 5) continue; // الجمعة عطلة

      for (const [index, halaqaId] of halaqaIds.entries()) {
        // غياب نادر للأستاذ نفسه — يجعل تقرير الكادر غير مثالي عمداً
        const teacherAbsent = chance(0.04);
        const stamp = isoStamp(date, 16 + index, randInt(5, 40));

        const sessionInfo = await db().run(
          `INSERT INTO attendance_sessions
             (halaqa_id, date, teacher_status, notes, recorded_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            halaqaId,
            isoDate(date),
            teacherAbsent ? "absent" : "present",
            teacherAbsent ? "أُسندت الحلقة إلى أستاذ بديل" : null,
            adminId,
            stamp,
            stamp,
          ]
        );
        const sessionId = sessionInfo.lastInsertRowid;
        sessionCount++;

        for (const s of studentRows.filter((r) => r.halaqaId === halaqaId)) {
          const p = PROFILE[levelOf.get(s.id)!];

          let status: "present" | "late" | "absent" | "excused";
          if (chance(p.attend)) status = chance(p.late) ? "late" : "present";
          else status = chance(0.3) ? "excused" : "absent";

          await db().run(
            "INSERT INTO attendance_entries (session_id, student_id, status) VALUES (?, ?, ?)",
            [sessionId, s.id, status]
          );

          if (status === "present" || status === "late") {
            // المتأخر ينال نصف نقاط الحضور
            const delta = Math.round(
              config.pointRules.attendancePresent * (status === "late" ? 0.5 : 1)
            );
            await award(s.id, delta, `حضور ${isoDate(date)}`, "attendance", sessionId, stamp);
          }
        }
      }
    }

    // ── التسميع: في معظم أيام الحضور ────────────────────────────────────
    // كل طالب يتقدّم في المصحف من صفحة بداية خاصة به، فتبدو سجلاته متسلسلة
    const progress = new Map(studentRows.map((s, i) => [s.id, 582 + (i % 8) * 2]));
    let recitationCount = 0;

    const attended = await db().all<{ studentId: number; date: string; halaqaId: number }>(
      `SELECT e.student_id AS "studentId", a.date, a.halaqa_id AS "halaqaId"
       FROM attendance_entries e
       JOIN attendance_sessions a ON a.id = e.session_id
       WHERE e.status IN ('present', 'late')
       ORDER BY a.date, e.student_id`
    );

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
      // منطقيّ لا عدد: عمود Postgres من نوع boolean
      let pageCompleted = false;
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
        pageCompleted = chance(0.5);
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

      const recInfo = await db().run(
        `INSERT INTO recitations
           (student_id, halaqa_id, type, page_number, to_page, verse, page_completed,
            surah_number, rating, notes, recited_at, recorded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
          stamp,
        ]
      );
      const recitationId = recInfo.lastInsertRowid;
      recitationCount++;

      // نستعمل دالة الخادم نفسها لحساب النقاط، فتطابق بيانات العرض ما ينتجه
      // التطبيق حين يسجّل المستخدم تسميعاً جديداً أمام الزائر.
      const delta = recitationPoints({ rating, type, pageNumber, toPage, surahNumber });
      const label = type === "surah" ? `سورة ${surahNumber}` : `صفحة ${pageNumber}`;
      await award(row.studentId, delta, `تسميع ${label}`, "recitation", recitationId, stamp);
    }

    // ── مكافآت وخصومات يدوية ────────────────────────────────────────────
    let manualCount = 0;

    for (const s of studentRows) {
      for (let i = 0; i < randInt(1, 3); i++) {
        const bonus = pick(BONUSES);
        await award(
          s.id,
          bonus.delta,
          bonus.reason,
          "manual",
          null,
          isoStamp(daysAgo(randInt(1, HISTORY_DAYS)), 18, randInt(0, 59))
        );
        manualCount++;
      }

      if (levelOf.get(s.id) !== "strong" && chance(0.6)) {
        const penalty = pick(PENALTIES);
        await award(
          s.id,
          penalty.delta,
          penalty.reason,
          "manual",
          null,
          isoStamp(daysAgo(randInt(1, HISTORY_DAYS)), 18, randInt(0, 59))
        );
        manualCount++;
      }
    }

    // كتابة الأرصدة النهائية
    for (const [studentId, total] of balances) {
      await db().run("UPDATE students SET points = ? WHERE id = ?", [total, studentId]);
    }

    console.log(
      `  جلسات حضور: ${sessionCount} | تسميعات: ${recitationCount} | حركات نقاط يدوية: ${manualCount}`
    );
  });

  const counts = await db().get(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM halaqat) AS halaqat,
            (SELECT COUNT(*) FROM students) AS students,
            (SELECT COUNT(*) FROM attendance_sessions) AS sessions,
            (SELECT COUNT(*) FROM attendance_entries) AS entries,
            (SELECT COUNT(*) FROM recitations) AS recitations,
            (SELECT COUNT(*) FROM point_transactions) AS points`
  );

  const top = await db().all<{ name: string; points: number }>(
    "SELECT name, points FROM students ORDER BY points DESC LIMIT 3"
  );

  console.log("\n✔ تم تجهيز بيانات النسخة التجريبية:", counts);
  console.log(`  القاعدة: ${config.databaseUrl ? "PostgreSQL" : config.dbFile}`);
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
}

// تشغيل مباشر من سطر الأوامر: npm run db:seed-demo
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { closeDb } = await import("./index.js");
  await seedDemo();
  await closeDb();
}
