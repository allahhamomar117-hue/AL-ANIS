-- =====================================================================
-- تصحيحات مخطط PostgreSQL | معالجة انحراف القواعد القائمة
--
-- لماذا ملفّ مستقلّ لا ترقية في migrations/؟
--   مسار Postgres في migrate() لا يمرّ بمجلّد migrations/ إطلاقاً: يطبّق
--   schema.pg.sql ثم يعود. وملفّ المخطّط مبنيّ كلّه على
--   `CREATE TABLE IF NOT EXISTS` فلا يلمس جدولاً قائماً — ومن هنا جاء
--   الانحراف أصلاً: قاعدة أُنشئت من إصدار أقدم بقيت على أنواعه القديمة،
--   وملفُّ المخطّط لا يصحّحها أبداً مهما أُعيد تطبيقه.
--
-- هذا الملف يُطبَّق بعد المخطّط في كل إقلاع، وكل تصحيح فيه محروس بفحص
-- information_schema فيصير لا-عمليّة (no-op) بمجرّد أن يصحّ الوضع. لا
-- جدول إصدارات هنا: مسار Postgres كلّه مبنيّ على إعادة التطبيق الآمنة،
-- فالحراسة بالحالة الفعلية أصدق من رقم إصدار قد يكذب على قاعدة عُدّلت
-- يدوياً.
--
-- ⚠ الملف يُطبَّق على قاعدة الإنتاج عند كل إقلاع: لا تضع فيه إلا ما هو
--   آمن للتكرار، ولا تضع فيه حذفاً أو إعادة تسمية تفقد بيانات.
-- =====================================================================

-- ── أعمدة التاريخ: text → date ───────────────────────────────────────
--
-- schema.pg.sql يعلن هذه الأعمدة DATE، لكنها جاءت text في قاعدة الإنتاج
-- (أُنشئت قبل الملف الحالي). النتيجة كانت سقوط الإحصاءات بـ
-- "function to_char(text, unknown) does not exist" — وهو عَرَضٌ واحد
-- لعلّة تطال كل دالة تاريخ تُستدعى على هذه الأعمدة.
--
-- التحويل يجري لكل عمود على حدة وبحذر:
--   1. يُتخطّى العمود إن كان من نوع date أصلاً (أو غير موجود).
--   2. تُفحص كل القيم أولاً؛ فإن كانت فيها قيمة لا تطابق YYYY-MM-DD
--      تُرفع تنبيهة ويُترك العمود كما هو بدل أن يسقط ALTER.
--
-- الخطوة الثانية مقصودة: لو رُمي الخطأ لفشل الإقلاع كلّه بسبب صفّ واحد
-- معطوب، فيتوقّف الخادم عن العمل بدل أن يعمل ناقصاً — والكود يحتمل
-- النوعين على أي حال بفضل التحويل الصريح في sqlfn.monthOf.
DO $$
DECLARE
  target  record;
  bad     bigint;
  changed boolean := false;
BEGIN
  FOR target IN
    SELECT *
    FROM (VALUES
      ('recitations',         'recited_at'),
      ('attendance_sessions', 'date'),
      ('students',            'birth_date')
    ) AS t(tbl, col)
  LOOP
    /*
     * الشرط محصور بالأنواع النصّية عمداً، لا بـ `data_type <> 'date'`.
     *
     * الانحراف المرصود نصّيّ، والفحص التالي (تطابق YYYY-MM-DD) لا معنى
     * له إلا على نصّ: تطبيق عامل `!~` على عمود timestamp يسقط بخطأ
     * "operator does not exist". فنحن نصحّح ما نعرفه ونترك ما عداه.
     */
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name   = target.tbl
        AND column_name  = target.col
        AND data_type    IN ('text', 'character varying', 'character')
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I WHERE %I IS NOT NULL AND %I !~ ''^\d{4}-\d{2}-\d{2}$''',
      target.tbl, target.col, target.col
    ) INTO bad;

    IF bad > 0 THEN
      RAISE WARNING
        'تخطّي تحويل %.% إلى date: % صفّاً بصيغة غير YYYY-MM-DD. صحّح هذه الصفوف ثم أعد الإقلاع.',
        target.tbl, target.col, bad;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE date USING %I::date',
      target.tbl, target.col, target.col
    );
    changed := true;
    RAISE NOTICE 'حُوّل %.% من نصّ إلى date', target.tbl, target.col;
  END LOOP;

  IF NOT changed THEN
    RAISE NOTICE 'أعمدة التاريخ سليمة — لا تصحيح مطلوب';
  END IF;
END $$;

-- ── طور الطالب: عمود status (الأرشفة) ───────────────────────────────
--
-- نظير الترقية 009 لـ SQLite. تُكتب هنا لأن مسار Postgres لا يقرأ
-- migrations/‎، و`CREATE TABLE IF NOT EXISTS` في المخطّط لا يضيف عموداً
-- إلى جدول قائم — فالقاعدة العاملة لن ترى العمود أبداً بدون هذا.
--
-- ADD COLUMN IF NOT EXISTS يجعلها آمنة للتكرار، والقيد يُضاف باسم صريح
-- يطابق ما تولّده Postgres للقيد المضمّن في المخطّط
-- (students_status_check)، فلا يُضاف مرّتين على قاعدة جديدة.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check'
  ) THEN
    ALTER TABLE students
      ADD CONSTRAINT students_status_check CHECK (status IN ('active', 'archived'));
    RAISE NOTICE 'أُضيف قيد students_status_check';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_status ON students (status);
