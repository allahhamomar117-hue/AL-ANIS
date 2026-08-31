-- =====================================================================
-- الأنيس | هيكلية قاعدة البيانات (PostgreSQL / Supabase)
--
-- نظير schema.sql بأنواع Postgres. الفروق المقصودة:
--   INTEGER PRIMARY KEY AUTOINCREMENT → GENERATED ALWAYS AS IDENTITY
--   INTEGER (منطقي 0/1)               → BOOLEAN
--   TEXT DEFAULT (datetime('now'))    → TIMESTAMPTZ DEFAULT now()
--   PRAGMA foreign_keys               → مفعّل دائماً في Postgres
-- أبقِ هذا الملف متوافقاً مع schema.sql عند أي تعديل على المخطط.
-- =====================================================================

-- المستخدمون: المدير والمشرفون والمدرّسون
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL,
  username      TEXT,
  password_hash TEXT,
  phone_number  TEXT,
  country_code  TEXT        NOT NULL DEFAULT '963',
  role          TEXT        NOT NULL DEFAULT 'TEACHER'
                            CHECK (role IN ('ADMIN', 'SUPERVISOR', 'TEACHER')),
  -- نطاق الإداري: NULL = المعهد كامل (مدير عام)، وقيمة = قسم واحد
  -- PRIMARY | MIDDLE_HIGH | INTENSIVE. لا يعني المدرّس.
  department    TEXT        CHECK (department IS NULL
                                   OR department IN ('PRIMARY', 'MIDDLE_HIGH', 'INTENSIVE')),
  fcm_token     TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, phone_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- رموز التحقق المؤقتة (OTP)
CREATE TABLE IF NOT EXISTS otp_codes (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_code  TEXT        NOT NULL,
  phone_number  TEXT        NOT NULL,
  code          TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes (country_code, phone_number);

-- الحلقات
CREATE TABLE IF NOT EXISTS halaqat (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL UNIQUE,
  teacher_id    INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  schedule_time TEXT,
  location      TEXT,
  -- المرحلة الدراسية: primary | preparatory | secondary (يتحقق منها الـ API)
  stage         TEXT,
  -- قسم المعهد. يقبل NULL للحلقات السابقة للترقية 012 وحدها.
  department    TEXT        CHECK (department IS NULL
                                   OR department IN ('PRIMARY', 'MIDDLE_HIGH', 'INTENSIVE')),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_halaqat_teacher ON halaqat (teacher_id);
-- idx_halaqat_department ليس هنا بل في fixups.pg.sql — وهذا مقصود:
--
-- `CREATE TABLE IF NOT EXISTS` مشروط بوجود الجدول، أمّا `CREATE INDEX`
-- فيُنفَّذ دائماً. فعلى قاعدة قائمة يُتخطّى إنشاء halaqat (فلا يُضاف عمود
-- department) ثم يُحاول فهرسته، فيسقط بـ
-- `column "department" does not exist` — وهو ما أوقف الإنتاج فعلاً.
--
-- ⚠ القاعدة العامة: أيّ فهرس أو قيد على عمود تضيفه fixups.pg.sql يجب أن
--   يُكتب هناك بعد إضافة العمود، لا هنا. راجع أيضاً idx_students_status.

-- إسناد المدرّسين إلى الحلقات
CREATE TABLE IF NOT EXISTS teacher_halaqat (
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  halaqa_id  INTEGER     NOT NULL REFERENCES halaqat (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, halaqa_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_halaqat_user ON teacher_halaqat (user_id);

-- الطلاب
CREATE TABLE IF NOT EXISTS students (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  halaqa_id     INTEGER     REFERENCES halaqat (id) ON DELETE SET NULL,
  birth_date    DATE,
  student_phone TEXT,
  parent_phone  TEXT,
  avatar_url    TEXT,
  points        INTEGER     NOT NULL DEFAULT 0,
  -- طور الطالب: active جارٍ في الدورة، archived انتهت دورته
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'archived')),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_students_halaqa ON students (halaqa_id);

-- جلسة حضور واحدة لكل حلقة في اليوم
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  halaqa_id      INTEGER     NOT NULL REFERENCES halaqat (id) ON DELETE CASCADE,
  date           DATE        NOT NULL,
  teacher_status TEXT        NOT NULL DEFAULT 'present'
                             CHECK (teacher_status IN ('present', 'absent')),
  notes          TEXT,
  recorded_by    INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (halaqa_id, date)
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON attendance_sessions (date);

-- حضور الطلاب داخل الجلسة
CREATE TABLE IF NOT EXISTS attendance_entries (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  status     TEXT    NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_entries_student ON attendance_entries (student_id);

-- التلاوة والتسميع
CREATE TABLE IF NOT EXISTS recitations (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id     INTEGER     NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  halaqa_id      INTEGER     REFERENCES halaqat (id) ON DELETE SET NULL,
  type           TEXT        NOT NULL CHECK (type IN ('full', 'half', 'more', 'surah')),
  page_number    INTEGER     NOT NULL,
  to_page        INTEGER,
  verse          INTEGER,
  page_completed BOOLEAN     NOT NULL DEFAULT FALSE,
  surah_number   INTEGER,
  rating         TEXT        NOT NULL CHECK (rating IN ('excellent', 'good', 'needs')),
  notes          TEXT,
  recited_at     DATE        NOT NULL,
  recorded_by    INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recitations_student ON recitations (student_id, recited_at);
CREATE INDEX IF NOT EXISTS idx_recitations_halaqa ON recitations (halaqa_id, recited_at);
CREATE INDEX IF NOT EXISTS idx_recitations_surah ON recitations (surah_number);

-- سجل النقاط
CREATE TABLE IF NOT EXISTS point_transactions (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id   INTEGER     NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  delta        INTEGER     NOT NULL,
  reason       TEXT,
  kind         TEXT        NOT NULL DEFAULT 'manual'
                           CHECK (kind IN ('manual', 'attendance', 'recitation', 'adjustment', 'awqaf')),
  reference_id INTEGER,
  created_by   INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_points_student ON point_transactions (student_id, created_at);

-- سجلّات شهادات وسبر الأوقاف
CREATE TABLE IF NOT EXISTS awqaf_records (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id INTEGER     NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  exam_month TEXT        NOT NULL,               -- شهر السبر بصيغة YYYY-MM
  status     TEXT        NOT NULL DEFAULT 'nominated'
                         CHECK (status IN ('nominated', 'passed', 'failed')),
  -- الجزء المُختبَر 1..30. يقبل NULL للصفوف السابقة وحدها؛ الإنشاء
  -- الجديد يوجبه في POST /api/awqaf.
  juz        INTEGER     CHECK (juz IS NULL OR juz BETWEEN 1 AND 30),
  -- حقل حرّ قديم: ارتفع عن الواجهة وبقي في الجدول لبيانات كُتبت سلفاً.
  notes      TEXT,
  created_by INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, exam_month)
);
CREATE INDEX IF NOT EXISTS idx_awqaf_month ON awqaf_records (exam_month);
CREATE INDEX IF NOT EXISTS idx_awqaf_student ON awqaf_records (student_id);
