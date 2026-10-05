-- =====================================================================
-- 019 | دور حساب شاشة العرض (VIEWER)
--
-- حسابٌ يُفتح على تلفاز المسجد ليعرض لوحة الصدارة أمام الطلاب. لا يكتب
-- شيئاً ولا يقرأ إلا لوحة الصدارة — والحصر مفروض في requireAuth بقائمة
-- سماح (middleware/auth.ts)، لا هنا. ما يخصّ القاعدة هو توسيع قيد CHECK
-- على العمود role وحده.
--
-- إعادة بناء الجدول هي السبيل الوحيد في SQLite لتعديل قيد CHECK (نمط
-- 005 و 017 نفسه). وهي آمنة: migrateSqlite يعطّل المفاتيح الأجنبية قبل
-- الترقيات ويشغّل foreign_key_check بعدها. التوسيع لا يُبطل أي صفّ قائم.
-- =====================================================================

CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  username      TEXT,
  password_hash TEXT,
  phone_number  TEXT,
  country_code  TEXT    NOT NULL DEFAULT '963',
  role          TEXT    NOT NULL DEFAULT 'TEACHER'
                        CHECK (role IN ('ADMIN', 'SUPERVISOR', 'TEACHER', 'VIEWER')),
  fcm_token     TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (country_code, phone_number)
);

INSERT INTO users_new
  (id, name, username, password_hash, phone_number, country_code,
   role, fcm_token, is_active, created_at)
SELECT
   id, name, username, password_hash, phone_number, country_code,
   role, fcm_token, is_active, created_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);
