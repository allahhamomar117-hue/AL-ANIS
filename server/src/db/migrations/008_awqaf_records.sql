-- =====================================================================
-- 008 | سجلّات شهادات وسبر الأوقاف
--
-- يربط الطالب بدورة سبر (شهر بصيغة YYYY-MM) وحالته فيها:
--   nominated مرشّح | passed ناجح | failed لم ينجح
--
-- سجلّ واحد لكل طالب في كل شهر (UNIQUE) — ترشيح مكرّر في نفس الدورة
-- يعني صفّين متضاربَين في الحالة، فيُمنع من القاعدة لا من الواجهة وحدها.
-- الحذف يتبع الطالب (CASCADE): سجلّ سبر لطالب محذوف بلا معنى.
-- =====================================================================

CREATE TABLE IF NOT EXISTS awqaf_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  exam_month TEXT    NOT NULL,                   -- YYYY-MM
  status     TEXT    NOT NULL DEFAULT 'nominated'
                     CHECK (status IN ('nominated', 'passed', 'failed')),
  notes      TEXT,
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, exam_month)
);
CREATE INDEX IF NOT EXISTS idx_awqaf_month ON awqaf_records (exam_month);
CREATE INDEX IF NOT EXISTS idx_awqaf_student ON awqaf_records (student_id);
