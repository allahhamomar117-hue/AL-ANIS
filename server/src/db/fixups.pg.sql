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
--
-- ── علامات ‎-- @fixup ────────────────────────────────────────────────
-- كل تصحيح يبدأ بسطر ‎`-- @fixup <اسم>`، وعليه يقسم applyPgFixups الملفَّ
-- فينفّذ كل كتلة باستدعاء مستقلّ.
--
-- وهذا ليس تنظيماً: نصٌّ متعدّد العبارات يُرسل في استدعاء واحد يُنفَّذ
-- داخل معاملة ضمنية واحدة، فعبارةٌ تفشل في آخر الملف تُلغي ما قبلها
-- كلَّه. وقد أوقف هذا الإنتاج فعلاً: أُلغيت إضافة عمود department بسبب
-- فشلٍ في كتلة أخرى، فأقلع الخادم على مخطّط ناقص.
--
-- ⚠ أيّ تصحيح جديد يجب أن يبدأ بعلامته، وإلا انضمّ إلى الكتلة التي
--   قبله وشاركها مصيرها. وما قبل أوّل علامة لا يُنفَّذ إطلاقاً.
-- =====================================================================

-- @fixup أعمدة التاريخ: text → date

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

-- @fixup طور الطالب: عمود status
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

-- @fixup نوع حركة نقاط: awqaf
-- ── نوع حركة نقاط: awqaf ────────────────────────────────────────────
--
-- نظير الترقية 010 لـ SQLite. تُكتب هنا لأن مسار Postgres لا يقرأ
-- migrations/‎، و`CREATE TABLE IF NOT EXISTS` لا يعدّل قيداً على جدول
-- قائم — فالقاعدة العاملة سترفض kind='awqaf' بدون هذا.
--
-- خلافاً لـ SQLite لا حاجة لإعادة بناء الجدول: يُسقَط القيد ويُضاف
-- موسَّعاً باسمه الصريح الذي تولّده Postgres للقيد المضمّن في المخطّط.
-- التوسيع لا يُبطل أي صفّ قائم (القيم المسموحة تزداد فقط).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'point_transactions_kind_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%awqaf%'
  ) THEN
    ALTER TABLE point_transactions DROP CONSTRAINT point_transactions_kind_check;
    RAISE NOTICE 'أُسقط قيد point_transactions_kind_check القديم';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_kind_check'
  ) THEN
    ALTER TABLE point_transactions
      ADD CONSTRAINT point_transactions_kind_check
      CHECK (kind IN ('manual', 'attendance', 'recitation', 'adjustment', 'awqaf'));
    RAISE NOTICE 'أُضيف قيد point_transactions_kind_check موسَّعاً بـ awqaf';
  END IF;
END $$;

-- @fixup الجزء المُختبَر: عمود juz
-- ── الجزء المُختبَر في سبر الأوقاف: عمود juz ─────────────────────────
--
-- نظير الترقية 011 لـ SQLite. تُكتب هنا لأن مسار Postgres لا يقرأ
-- migrations/‎، و`CREATE TABLE IF NOT EXISTS` لا يضيف عموداً إلى جدول
-- قائم — فالقاعدة العاملة سترفض الإدراج بعمود juz بدون هذا.
--
-- العمود يقبل NULL: الصفوف القديمة لا جزء لها، والإلزام مفروض في المسار
-- عند الإنشاء لا في القاعدة. القيد يُضاف باسمه الصريح الذي تولّده
-- Postgres للقيد المضمّن في المخطّط، فلا يُضاف مرّتين على قاعدة جديدة.
ALTER TABLE awqaf_records
  ADD COLUMN IF NOT EXISTS juz INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'awqaf_records_juz_check'
  ) THEN
    ALTER TABLE awqaf_records
      ADD CONSTRAINT awqaf_records_juz_check
      CHECK (juz IS NULL OR juz BETWEEN 1 AND 30);
    RAISE NOTICE 'أُضيف قيد awqaf_records_juz_check';
  END IF;
END $$;

-- @fixup أقسام المعهد: الأعمدة
-- ── أقسام المعهد: عمود department في users و halaqat ────────────────
--
-- نظير الترقية 012 لـ SQLite. تُكتب هنا لأن مسار Postgres لا يقرأ
-- migrations/‎، و`CREATE TABLE IF NOT EXISTS` لا يضيف عموداً إلى جدول
-- قائم — فقاعدة الإنتاج ستسقط بـ "column department does not exist"
-- عند أول استعلام مقسوم بدون هذا.
--
-- العمودان يقبلان NULL، ودلالته تختلف بين الجدولين:
--   users.department   NULL ⇒ نطاق المعهد كامل (المدير العام).
--   halaqat.department NULL ⇒ حلقة لم تُسنَد بعد، لا يراها إلا المدير العام.
--
-- القيدان يُضافان بالاسمين الصريحين اللذين تولّدهما Postgres للقيدين
-- المضمّنين في المخطّط، فلا يُضافان مرّتين على قاعدة جديدة.
ALTER TABLE users   ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE halaqat ADD COLUMN IF NOT EXISTS department TEXT;

-- @fixup أقسام المعهد: القيود
--
-- كتلة مستقلّة عن الأعمدة عمداً: العمود شرطٌ لعمل الخادم (بدونه يسقط كل
-- استعلام مقسوم)، والقيدُ حارسُ سلامةٍ يعمل الخادم بدونه. فصلُهما يمنع
-- فشلاً في القيد من أن يُلغي العمود معه.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_department_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_department_check
      CHECK (department IS NULL OR department IN ('PRIMARY', 'MIDDLE_HIGH', 'INTENSIVE'));
    RAISE NOTICE 'أُضيف قيد users_department_check';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'halaqat_department_check'
  ) THEN
    ALTER TABLE halaqat
      ADD CONSTRAINT halaqat_department_check
      CHECK (department IS NULL OR department IN ('PRIMARY', 'MIDDLE_HIGH', 'INTENSIVE'));
    RAISE NOTICE 'أُضيف قيد halaqat_department_check';
  END IF;
END $$;

-- @fixup أقسام المعهد: الفهرس
--
-- موضعه هنا لا في schema.pg.sql: الفهرس يحتاج العمود موجوداً، والعمود
-- يُضاف في كتلة «الأعمدة» أعلاه. ووضعُه في ملفّ المخطّط كان يعمل على
-- قاعدة جديدة ويسقط على قاعدة قائمة — وهي العلّة التي أوقفت الإنتاج.
CREATE INDEX IF NOT EXISTS idx_halaqat_department ON halaqat (department);
