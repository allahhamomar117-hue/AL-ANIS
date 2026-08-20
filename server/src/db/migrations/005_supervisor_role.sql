-- =====================================================================
-- 005 | دور المشرف (SUPERVISOR) بين المدير والأستاذ
--
--   ADMIN      : مدير — كل البيانات + إدارة حسابات الكادر.
--   SUPERVISOR : مشرف — كل الحلقات والطلاب والتقارير، بلا إدارة حسابات.
--   TEACHER    : أستاذ — حلقاته فقط.
--
-- SQLite لا يسمح بتعديل قيد CHECK، فنُعيد بناء الجدول. الحسابات القائمة
-- بدور ADMIN تبقى مديرين (لا نخفض صلاحية أحد أثناء الترقية).
-- =====================================================================

CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  username      TEXT,
  password_hash TEXT,
  phone_number  TEXT    NOT NULL,
  country_code  TEXT    NOT NULL DEFAULT '963',
  role          TEXT    NOT NULL DEFAULT 'TEACHER'
                        CHECK (role IN ('ADMIN', 'SUPERVISOR', 'TEACHER')),
  fcm_token     TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (country_code, phone_number)
);

INSERT INTO users_new (id, name, username, password_hash, phone_number, country_code,
                       role, fcm_token, is_active, created_at)
SELECT id, name, username, password_hash, phone_number, country_code,
       role, fcm_token, is_active, created_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);
