-- =====================================================================
-- 009 | طور الطالب (الأرشفة)
--
-- status: active جارٍ في الدورة | archived انتهت دورته.
--
-- مستقلّ عن is_active عمداً: ذاك سجلٌّ أُلغي لخطأ إدخال، وهذا طالب أنهى
-- دورته. الفصل يسمح باسترجاع دورةٍ مؤرشفة بلا أن يعود معها المحذوف خطأً.
--
-- العمود نصّي بلا CHECK لأن ALTER TABLE في SQLite لا يعيد بناء الجدول،
-- والتحقق مطبَّق في طبقة الـ API (zod) — نفس نهج الترقية 007.
--
-- ⚠ هذه الترقية لـ SQLite وحده. مسار Postgres لا يقرأ migrations/ أصلاً؛
--   نظيرها هناك في fixups.pg.sql.
-- =====================================================================

ALTER TABLE students ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_students_status ON students (status);
