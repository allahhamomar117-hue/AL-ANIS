-- =====================================================================
-- 004 | نوع التسميع "سورة"
--
-- كان التسميع بالسور يُخزَّن بالنوع 'full' (صفحة كاملة) لأن قيد CHECK
-- لم يكن يسمح بغيره، فظهرت سور قصيرة كسورة المسد بوصف "صفحة كاملة".
-- نضيف القيمة 'surah' إلى القيد — وهذا يستلزم إعادة بناء الجدول لأن
-- SQLite لا يعدّل CHECK — ثم نصحّح الصفوف القائمة التي تحمل رقم سورة.
-- =====================================================================

CREATE TABLE recitations_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id     INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  halaqa_id      INTEGER REFERENCES halaqat (id) ON DELETE SET NULL,
  type           TEXT    NOT NULL CHECK (type IN ('full', 'half', 'more', 'surah')),
  page_number    INTEGER NOT NULL,
  to_page        INTEGER,
  verse          INTEGER,
  page_completed INTEGER NOT NULL DEFAULT 0,
  surah_number   INTEGER,
  rating         TEXT    NOT NULL CHECK (rating IN ('excellent', 'good', 'needs')),
  notes          TEXT,
  recited_at     TEXT    NOT NULL,
  recorded_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO recitations_new
  (id, student_id, halaqa_id, type, page_number, to_page, verse, page_completed,
   surah_number, rating, notes, recited_at, recorded_by, created_at)
SELECT
  id, student_id, halaqa_id,
  CASE WHEN surah_number IS NOT NULL THEN 'surah' ELSE type END,
  page_number, to_page, verse, page_completed,
  surah_number, rating, notes, recited_at, recorded_by, created_at
FROM recitations;

DROP TABLE recitations;
ALTER TABLE recitations_new RENAME TO recitations;

CREATE INDEX IF NOT EXISTS idx_recitations_student ON recitations (student_id, recited_at);
CREATE INDEX IF NOT EXISTS idx_recitations_halaqa ON recitations (halaqa_id, recited_at);
CREATE INDEX IF NOT EXISTS idx_recitations_surah ON recitations (surah_number);
