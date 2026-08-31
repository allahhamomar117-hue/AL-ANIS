-- =====================================================================
-- الأنيس | هيكلية قاعدة البيانات (SQLite)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- المستخدمون: المدير والمشرفون والمدرّسون (الدخول باسم المستخدم وكلمة المرور)
--   ADMIN      : يرى كل شيء ويدير حسابات الكادر (إنشاء/تعديل/تعطيل).
--   SUPERVISOR : يرى كل الحلقات والطلاب والتقارير، بلا إدارة حسابات.
--   TEACHER    : يرى حلقاته المسندة إليه وطلابها فقط.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  username      TEXT,                       -- اسم الدخول (فريد عند وجوده)
  password_hash TEXT,                       -- تجزئة كلمة المرور (scrypt)
  phone_number  TEXT,                       -- اختياري: الدخول باسم المستخدم
  country_code  TEXT    NOT NULL DEFAULT '963',
  role          TEXT    NOT NULL DEFAULT 'TEACHER'
                        CHECK (role IN ('ADMIN', 'SUPERVISOR', 'TEACHER')),
  fcm_token     TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (country_code, phone_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- رموز التحقق المؤقتة (OTP)
CREATE TABLE IF NOT EXISTS otp_codes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code  TEXT    NOT NULL,
  phone_number  TEXT    NOT NULL,
  code          TEXT    NOT NULL,
  expires_at    TEXT    NOT NULL,
  consumed_at   TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes (country_code, phone_number);

-- الحلقات
CREATE TABLE IF NOT EXISTS halaqat (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL UNIQUE,
  teacher_id    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  schedule_time TEXT,
  location      TEXT,
  -- المرحلة الدراسية: primary | preparatory | secondary (يتحقق منها الـ API)
  stage         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_halaqat_teacher ON halaqat (teacher_id);

-- إسناد المدرّسين إلى الحلقات (مدرّس واحد يمكن أن يُسند إلى أكثر من حلقة).
-- نطاق رؤية المدرّس = حلقاته هنا + الحلقة التي هو أستاذها الأساسي (halaqat.teacher_id).
CREATE TABLE IF NOT EXISTS teacher_halaqat (
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  halaqa_id   INTEGER NOT NULL REFERENCES halaqat (id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, halaqa_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_halaqat_user ON teacher_halaqat (user_id);

-- الطلاب
CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,          -- الرقم الأكاديمي مثل 2024001
  name          TEXT    NOT NULL,
  halaqa_id     INTEGER REFERENCES halaqat (id) ON DELETE SET NULL,
  birth_date    TEXT,
  student_phone TEXT,
  parent_phone  TEXT,
  avatar_url    TEXT,
  points        INTEGER NOT NULL DEFAULT 0,       -- الرصيد المحسوب من point_transactions
  -- طور الطالب: active جارٍ في الدورة، archived انتهت دورته.
  -- مستقلّ عن is_active عمداً: ذاك سجلّ أُلغي لخطأ إدخال، وهذا طالب
  -- أنهى دورته وتبقى سجلاته التاريخية كاملة.
  status        TEXT    NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_halaqa ON students (halaqa_id);

-- جلسة حضور واحدة لكل حلقة في اليوم (تشمل حالة الأستاذ)
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  halaqa_id      INTEGER NOT NULL REFERENCES halaqat (id) ON DELETE CASCADE,
  date           TEXT    NOT NULL,                -- YYYY-MM-DD
  teacher_status TEXT    NOT NULL DEFAULT 'present'
                         CHECK (teacher_status IN ('present', 'absent')),
  notes          TEXT,
  recorded_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (halaqa_id, date)
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON attendance_sessions (date);

-- حضور الطلاب داخل الجلسة
CREATE TABLE IF NOT EXISTS attendance_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  status     TEXT    NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_entries_student ON attendance_entries (student_id);

-- التلاوة والتسميع
CREATE TABLE IF NOT EXISTS recitations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id     INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  halaqa_id      INTEGER REFERENCES halaqat (id) ON DELETE SET NULL,
  type           TEXT    NOT NULL CHECK (type IN ('full', 'half', 'more', 'surah')),
  page_number    INTEGER NOT NULL,                -- صفحة البداية
  to_page        INTEGER,                         -- لنوع "more"
  verse          INTEGER,                         -- لنوع "half"
  page_completed INTEGER NOT NULL DEFAULT 0,      -- لنوع "half"
  surah_number   INTEGER,                         -- 78..114 للتسميع بالسور، NULL للصفحات
  rating         TEXT    NOT NULL CHECK (rating IN ('excellent', 'good', 'needs')),
  notes          TEXT,
  recited_at     TEXT    NOT NULL,                -- YYYY-MM-DD
  recorded_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recitations_student ON recitations (student_id, recited_at);
CREATE INDEX IF NOT EXISTS idx_recitations_halaqa ON recitations (halaqa_id, recited_at);
CREATE INDEX IF NOT EXISTS idx_recitations_surah ON recitations (surah_number);

-- سجل النقاط: كل إضافة أو خصم تُقيَّد هنا، و students.points هو مجموعها
CREATE TABLE IF NOT EXISTS point_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL,                 -- موجب للإضافة وسالب للخصم
  reason        TEXT,
  kind          TEXT    NOT NULL DEFAULT 'manual'
                        CHECK (kind IN ('manual', 'attendance', 'recitation', 'adjustment')),
  reference_id  INTEGER,                          -- معرّف التلاوة أو الجلسة المرتبطة
  created_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_points_student ON point_transactions (student_id, created_at);

-- سجلّات شهادات وسبر الأوقاف: ترشيح الطالب لدورة سبر (شهر) ونتيجته فيها.
-- سجلّ واحد لكل طالب في كل شهر — الترشيح المكرّر يُنتج حالتين متضاربتين.
CREATE TABLE IF NOT EXISTS awqaf_records (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  exam_month    TEXT    NOT NULL,                -- شهر السبر بصيغة YYYY-MM
  status        TEXT    NOT NULL DEFAULT 'nominated'
                        CHECK (status IN ('nominated', 'passed', 'failed')),
  notes         TEXT,
  created_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, exam_month)
);
CREATE INDEX IF NOT EXISTS idx_awqaf_month ON awqaf_records (exam_month);
CREATE INDEX IF NOT EXISTS idx_awqaf_student ON awqaf_records (student_id);
