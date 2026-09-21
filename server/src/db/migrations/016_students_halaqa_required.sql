-- =====================================================================
-- 016 | الحلقة إلزامية لكل طالب
--
-- جدول students بلا عمود قسم: انتماء الطالب إلى قسمٍ يمرّ بحلقته وحدها
-- (accessibleHalaqaIds في services/scope.ts). فالطالب بلا حلقة لا يقع في
-- نطاق أي قسم، ولا يظهر في قائمة حلقة ولا حضور ولا تسميع — يوجد في
-- القاعدة ولا يُرى، ولا شيء في الواجهة يعرض «طلاباً بلا حلقة» فيُذكّر
-- بإسناده. المنع كان في طبقة الـ API وحدها، وهنا يصير قيداً في القاعدة.
--
-- ── الطلاب المعلَّقون (إن وُجدوا) ────────────────────────────────────
-- قيدٌ NOT NULL على عمودٍ فيه NULL يُسقط الترقية فيمنع الإقلاع. ولا
-- سبيل إلى استنتاج حلقة الطالب من بياناته، فالاختيار بين إسقاط الترقية
-- وبين إسنادٍ مرئيّ يُصحَّح يدوياً — والثاني أسلم.
--
-- فتُنشأ «حلقة غير مُسندة» وتُنقل إليها هذه الصفوف، معطَّلةً (is_active = 0)
-- حتى لا تظهر في قوائم الاختيار ولا تُحسب حلقةً عاملة. والحلقة لا تُنشأ
-- إطلاقاً إن لم يكن ثمّة صفٌّ معلَّق — وهي الحال المتوقَّعة.
--
-- ── إعادة بناء الجدول ───────────────────────────────────────────────
-- SQLite لا يملك ALTER COLUMN … SET NOT NULL، فالسبيل الوحيد إعادة بناء
-- الجدول. وهذا آمن هنا: migrateSqlite يعطّل المفاتيح الأجنبية قبل
-- الترقيات (وإلا فُسّر DROP TABLE حذفاً فتتالت CASCADE على السجلات)،
-- ويشغّل foreign_key_check بعدها.
--
-- و ON DELETE SET NULL صارت RESTRICT: القاعدة الآن «لا طالب بلا حلقة»،
-- فمحو حلقةٍ يحمل طلاباً يجب أن يُرَدّ لا أن يُفرّغ حقولهم. ولا مسار في
-- الـ API يحذف حلقةً أصلاً — التعطيل يوجب نقل الطلاب أولاً (راجع
-- DELETE /api/halaqat/:id).
-- =====================================================================

-- ── 1) إسناد المعلَّقين إلى حلقة ظاهرة ───────────────────────────────
INSERT INTO halaqat (name, is_active)
SELECT 'حلقة غير مُسندة', 0
WHERE EXISTS (SELECT 1 FROM students WHERE halaqa_id IS NULL)
  AND NOT EXISTS (SELECT 1 FROM halaqat WHERE name = 'حلقة غير مُسندة');

UPDATE students
SET    halaqa_id = (SELECT id FROM halaqat WHERE name = 'حلقة غير مُسندة')
WHERE  halaqa_id IS NULL;

-- ── 2) إعادة بناء الجدول بالقيد ──────────────────────────────────────
CREATE TABLE students_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  -- إلزامية: انتماء الطالب إلى قسمٍ يمرّ بها وحدها
  halaqa_id     INTEGER NOT NULL REFERENCES halaqat (id) ON DELETE RESTRICT,
  birth_date    TEXT,
  student_phone TEXT,
  parent_phone  TEXT,
  avatar_url    TEXT,
  points        INTEGER NOT NULL DEFAULT 0,
  status        TEXT    NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO students_new
  (id, code, name, halaqa_id, birth_date, student_phone, parent_phone,
   avatar_url, points, status, is_active, created_at)
SELECT
   id, code, name, halaqa_id, birth_date, student_phone, parent_phone,
   avatar_url, points, status, is_active, created_at
FROM students;

DROP TABLE students;
ALTER TABLE students_new RENAME TO students;

CREATE INDEX IF NOT EXISTS idx_students_halaqa ON students (halaqa_id);
