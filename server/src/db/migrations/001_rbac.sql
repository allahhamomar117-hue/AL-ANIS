-- =====================================================================
-- 001 | أدوار ADMIN/TEACHER وإسناد المدرّسين إلى الحلقات
--
-- SQLite لا يسمح بتعديل قيد CHECK، لذا نُعيد بناء جدول users
-- ونحوّل الأدوار القديمة: admin/supervisor → ADMIN، teacher → TEACHER.
-- =====================================================================

CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  phone_number  TEXT    NOT NULL,
  country_code  TEXT    NOT NULL DEFAULT '963',
  role          TEXT    NOT NULL DEFAULT 'TEACHER'
                        CHECK (role IN ('ADMIN', 'TEACHER')),
  fcm_token     TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (country_code, phone_number)
);

INSERT INTO users_new (id, name, phone_number, country_code, role, fcm_token, is_active, created_at)
SELECT id,
       name,
       phone_number,
       country_code,
       CASE WHEN LOWER(role) IN ('admin', 'supervisor') THEN 'ADMIN' ELSE 'TEACHER' END,
       fcm_token,
       is_active,
       created_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE TABLE IF NOT EXISTS teacher_halaqat (
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  halaqa_id   INTEGER NOT NULL REFERENCES halaqat (id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, halaqa_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_halaqat_user ON teacher_halaqat (user_id);

-- كل أستاذ أساسي لحلقة يصبح مُسنداً إليها صراحةً
INSERT OR IGNORE INTO teacher_halaqat (user_id, halaqa_id)
SELECT teacher_id, id FROM halaqat WHERE teacher_id IS NOT NULL;
