-- =====================================================================
-- 006 | رقم الهاتف اختياري
--
-- حسابات الكادر تُنشأ باسم مستخدم وكلمة مرور؛ الهاتف بيانات تكميلية.
-- كان العمود NOT NULL فاضطُرّ مسار الإنشاء إلى قيمة نائبة
-- (no-phone-<طابع زمني>) تلوّث الجدول. نجعله يقبل NULL ونُفرّغ النائبات.
--
-- UNIQUE (country_code, phone_number) يبقى: SQLite يعتبر كل NULL مميّزاً،
-- فتتعايش أي عدد من الحسابات بلا هاتف دون تضارب.
-- =====================================================================

CREATE TABLE users_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  username      TEXT,
  password_hash TEXT,
  phone_number  TEXT,
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
SELECT id, name, username, password_hash,
       CASE WHEN phone_number LIKE 'no-phone-%' OR TRIM(phone_number) = ''
            THEN NULL ELSE phone_number END,
       country_code, role, fcm_token, is_active, created_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);
