-- =====================================================================
-- 017 | الحساب يخدم أقساماً متعدّدة
--
-- users.department عمودٌ واحد يحمل قسماً واحداً، والواقع أن المشرف قد
-- يخدم قسمين أو ثلاثة. فيصير الارتباط many-to-many عبر جدول وسيط.
--
-- ── لماذا department نصّاً لا section_id؟ ───────────────────────────
-- لا جدول أقسام في هذا المشروع: الأقسام ثلاث قيم ثابتة في الكود
-- (DEPARTMENTS في middleware/auth.ts) مستعملة في halaqat.department
-- أيضاً، ويُقارَن بها مباشرةً في مواضع كثيرة ('INTENSIVE' مثلاً في
-- assertIntensiveHalaqa). فجدولٌ بمعرّفات رقمية كان سيوجب تحويل
-- halaqat.department وكل مقارنة في الكود — تغييرٌ أوسع بكثير من الحاجة،
-- ولا يشتريه إلا إمكانَ إضافة قسمٍ من الواجهة، وهي ليست مطلوبة.
-- الوسيط هنا علاقةٌ تامّة many-to-many، مفتاحُها نصّ لا رقم.
--
-- ── القائمة الفارغة = المعهد كلّه ───────────────────────────────────
-- المدير العام اليوم department = NULL، فلا يُنقل له صفّ إلى الجدول
-- الوسيط، فتصير قائمته فارغة — ويبقى مديراً عاماً بلا أي تدخّل. أي أن
-- الترحيل ترجمةٌ حرفية للسلوك القائم لا تغييرٌ في صلاحية أحد.
--
-- ── حذف العمود القديم ───────────────────────────────────────────────
-- يُحذف بعد النقل في المعاملة نفسها. إبقاؤه كان سيترك مصدرَين للحقيقة
-- الواحدة، وهو بالضبط ما أوقع هذا المشروع من قبل: عمود department
-- انحرف عن المخطّط فسقطت الإحصاءات. ومصدرٌ واحد أسلم من عمودٍ يذبل.
--
-- إعادة بناء الجدول هي السبيل الوحيد في SQLite (لا ALTER … DROP COLUMN
-- في إصداراته القديمة)، وهي آمنة هنا: migrateSqlite يعطّل المفاتيح
-- الأجنبية قبل الترقيات ويشغّل foreign_key_check بعدها.
-- =====================================================================

-- ── 1) الجدول الوسيط ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_departments (
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- PRIMARY | MIDDLE_HIGH | INTENSIVE — يتحقق من القيمة الـ API
  department TEXT    NOT NULL,
  PRIMARY KEY (user_id, department)
);
CREATE INDEX IF NOT EXISTS idx_user_departments_user
  ON user_departments (user_id);

-- ── 2) نقل الأقسام القائمة ───────────────────────────────────────────
-- المدير العام (NULL) لا صفّ له — وذلك هو المقصود.
INSERT INTO user_departments (user_id, department)
SELECT id, department FROM users WHERE department IS NOT NULL
ON CONFLICT (user_id, department) DO NOTHING;

-- ── 3) إعادة بناء users بلا العمود ───────────────────────────────────
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
