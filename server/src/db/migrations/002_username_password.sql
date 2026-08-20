-- =====================================================================
-- 002 | تسجيل الدخول باسم المستخدم وكلمة المرور
--
-- يُضاف الحقلان إلى users. تبقى حقول الهاتف كما هي لأن مسارات OTP
-- ما زالت متاحة، ورقم الهاتف يظهر في صفحة الإعدادات.
-- UNIQUE في SQLite يسمح بتعدّد NULL، فالحسابات القديمة بلا اسم مستخدم
-- تبقى صالحة إلى أن يُسنَد لها واحد.
-- =====================================================================

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);
