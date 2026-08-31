-- =====================================================================
-- 010 | نوع حركة نقاط جديد: awqaf
--
-- نجاح الطالب في سبر الأوقاف يمنحه نقاطاً، وهي حركة لها مصدرها الخاص:
-- تُقيَّد بـ kind='awqaf' و reference_id = معرّف سجلّ السبر، فتُسترجَع
-- وتُلغى بـ revertPointsFor('awqaf', id) عند تغيير النتيجة أو حذفها.
--
-- SQLite لا يعرف ALTER ... DROP CONSTRAINT، والقيد CHECK محفور في نصّ
-- الجدول — فالسبيل الوحيد إعادة بناء الجدول ونقل صفوفه. المفاتيح
-- الأجنبية مُعطَّلة أثناء الترقية من المُشغِّل (index.ts)، والكل داخل
-- معاملة واحدة، فلا يبقى الجدول ناقصاً إن فشلت خطوة.
-- =====================================================================

CREATE TABLE point_transactions_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL,                 -- موجب للإضافة وسالب للخصم
  reason        TEXT,
  kind          TEXT    NOT NULL DEFAULT 'manual'
                        CHECK (kind IN ('manual', 'attendance', 'recitation', 'adjustment', 'awqaf')),
  reference_id  INTEGER,                          -- معرّف التلاوة أو الجلسة أو سجلّ السبر
  created_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- الأعمدة مسمّاة صراحةً لا SELECT *: ترتيب الأعمدة لم يتغيّر، لكن
-- التسمية تجعل الترقية تفشل بوضوح لو تغيّر لاحقاً بدل أن تُزيح القيم.
INSERT INTO point_transactions_new
  (id, student_id, delta, reason, kind, reference_id, created_by, created_at)
SELECT id, student_id, delta, reason, kind, reference_id, created_by, created_at
FROM point_transactions;

DROP TABLE point_transactions;
ALTER TABLE point_transactions_new RENAME TO point_transactions;

-- الفهرس سقط مع الجدول القديم فيُعاد بناؤه.
CREATE INDEX IF NOT EXISTS idx_points_student ON point_transactions (student_id, created_at);
