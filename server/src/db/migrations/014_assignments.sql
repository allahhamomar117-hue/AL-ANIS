-- =====================================================================
-- 014 | المقرَّرات (الواجبات) — لقسم المكثفة
--
-- المقرَّر عنوانٌ يكتبه الأستاذ لحلقته في يوم ("حفظ صفحة 12"، "مراجعة
-- جزء عمّ")، ويؤشّر بجانب كل طالب أنجزه. الإنجاز يمنح نقاطاً ثابتة
-- (config.pointRules.assignmentDone)، والتراجع عنه يسحبها.
--
-- ── لماذا جدولان لا جدول واحد؟ ──────────────────────────────────────
-- العنوان صفةُ الحلقة في اليوم، والإنجاز صفةُ الطالب فيه. دمجهما يعني
-- تكرار العنوان في كل صفّ طالب، فتعديل حرف فيه يلزمه تحديث كل الصفوف.
-- وهو تقسيم attendance_sessions/attendance_entries نفسه.
--
-- ── لماذا UNIQUE (halaqa_id, date)? ─────────────────────────────────
-- مقرَّر واحد لكل حلقة في اليوم، كجلسة الحضور تماماً. القيد ليس تنظيماً
-- شكلياً: بدونه ينال الطالب مضاعفات النقاط في اليوم الواحد فتختلّ لوحة
-- الصدارة، ويصير عمود التقرير اليومي قائمةَ عناوين بدل حالةٍ واحدة.
-- وعليه واجهةُ الأستاذ تحرّر مقرَّر اليوم إن وُجد وتنشئه إن لم يوجد.
--
-- ── لماذا لا عمود department هنا؟ ───────────────────────────────────
-- القسم صفةُ الحلقة، ونسخُه هنا يفتح باب التناقض لو نُقلت الحلقة إلى
-- قسم آخر. الحصر على INTENSIVE مفروض في طبقة الـ API
-- (assertIntensiveHalaqa) على غرار كل قيود النطاق في المشروع.
--
-- ── لماذا لا عمود points؟ ───────────────────────────────────────────
-- النقاط ثابتة لكل إنجاز، فمكانها الإعدادات لا صفٌّ في القاعدة. لو
-- خُزّنت في الصفّ لتركَ تغييرُ القيمة لاحقاً سجلّاتٍ بقيم مختلطة لا
-- سبيل إلى تفسيرها.
--
-- ── لماذا لا عمود completed منطقي؟ ──────────────────────────────────
-- وجود الصفّ هو الإنجاز، والتراجع حذفُه. العمود المنطقي يترك صفوفاً
-- بـ false لا معنى لها، ويجعل "لم يُسجَّل بعد" و"سُجّل ثم أُلغي" حالتين
-- لا تفرّق بينهما الواجهة أصلاً.
-- =====================================================================

CREATE TABLE IF NOT EXISTS assignments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  halaqa_id     INTEGER NOT NULL REFERENCES halaqat (id) ON DELETE CASCADE,
  title         TEXT    NOT NULL,                -- عنوان المقرَّر كما يكتبه الأستاذ
  date          TEXT    NOT NULL,                -- YYYY-MM-DD
  created_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (halaqa_id, date)
);
CREATE INDEX IF NOT EXISTS idx_assignments_halaqa ON assignments (halaqa_id, date);

-- إنجاز طالب لمقرَّر: وجود الصفّ = أنجز، وحذفه = تراجع.
--
-- المعرّف الخاص (id) ضروري لا زينة: هو reference_id لحركة النقاط، فيصير
-- سحبُ نقاط طالب واحد revertPointsFor('assignment', id) بلا فلترة يدوية
-- على student_id — وهي الفلترة التي اضطُرّ إليها مسار الحضور لأن مرجعه
-- الجلسةُ المشتركة بين كل طلابها.
CREATE TABLE IF NOT EXISTS student_assignments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments (id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  completed_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  recorded_by   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_student_assignments_student
  ON student_assignments (student_id);
