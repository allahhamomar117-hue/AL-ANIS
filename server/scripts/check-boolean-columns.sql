-- فحص أنواع الأعمدة المنطقية في قاعدة Postgres.
-- المتوقَّع: boolean في الأربعة. أي "integer" يعني أن القاعدة نُقلت من
-- SQLite بأداة أبقت النوع عدداً، وهو سبب خطأ:
--   operator does not exist: integer = boolean
--
-- التشغيل: Supabase ← SQL Editor ← الصق ونفّذ.

SELECT table_name  AS "الجدول",
       column_name AS "العمود",
       data_type   AS "النوع الحالي",
       CASE WHEN data_type = 'boolean' THEN '✔ سليم' ELSE '✖ يحتاج تحويلاً' END AS "الحالة"
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'users'       AND column_name = 'is_active')
    OR (table_name = 'students'    AND column_name = 'is_active')
    OR (table_name = 'halaqat'     AND column_name = 'is_active')
    OR (table_name = 'recitations' AND column_name = 'page_completed')
  )
ORDER BY table_name, column_name;
