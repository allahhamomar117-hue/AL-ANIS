-- =====================================================================
-- تحويل الأعمدة المنطقية من integer إلى boolean في PostgreSQL.
--
-- يُشغَّل مرّة واحدة على قاعدة نُقلت من SQLite فبقيت أعمدة 0/1 أعداداً،
-- فظهر الخطأ: operator does not exist: integer = boolean
--
-- بعد التشغيل تطابق القاعدة server/src/db/schema.pg.sql، وتعمل عمليات
-- القراءة والكتابة معاً (لا تسجيل الدخول وحده).
--
-- التشغيل: Supabase ← SQL Editor ← الصق ونفّذ.
--
-- ⚠ خُذ نسخة احتياطية أولاً: Supabase ← Database ← Backups.
--   العملية تعيد كتابة الأعمدة، والتراجع عنها يتطلّب ALTER معاكساً.
-- =====================================================================

BEGIN;

-- USING يحدّد كيف تُترجم القيم القائمة: أي قيمة غير صفرية = true.
-- القيم الفارغة (NULL) تبقى NULL، ولذلك يُعاد ضبط الافتراضي بعدها.

ALTER TABLE users
  ALTER COLUMN is_active DROP DEFAULT,
  ALTER COLUMN is_active TYPE boolean USING (is_active <> 0),
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE students
  ALTER COLUMN is_active DROP DEFAULT,
  ALTER COLUMN is_active TYPE boolean USING (is_active <> 0),
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE halaqat
  ALTER COLUMN is_active DROP DEFAULT,
  ALTER COLUMN is_active TYPE boolean USING (is_active <> 0),
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE recitations
  ALTER COLUMN page_completed DROP DEFAULT,
  ALTER COLUMN page_completed TYPE boolean USING (page_completed <> 0),
  ALTER COLUMN page_completed SET DEFAULT FALSE,
  ALTER COLUMN page_completed SET NOT NULL;

COMMIT;

-- تحقّق: يجب أن تعود الأربعة boolean
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('is_active', 'page_completed')
ORDER BY table_name;
