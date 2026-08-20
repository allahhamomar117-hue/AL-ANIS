# الأنيس — Backend / API

خادم محلي بـ Express + SQLite لإدارة الحلقات والحضور والتلاوة والنقاط والتقارير.

## التشغيل

```bash
cd server
npm install
cp .env.example .env      # اختياري
npm run db:seed           # بيانات تجريبية مطابقة لأسماء الواجهات
npm run dev               # http://localhost:4000/api
```

من مجلد المشروع الرئيسي يمكن استخدام: `npm run api` و`npm run api:seed` و`npm run api:reset`.

الواجهة تصل للخادم عبر وسيط Vite: كل طلب `/api/*` يُحوَّل إلى `http://localhost:4000`.

للدخول: اسم المستخدم **عمار شهوري** (مشرف) أو **أيهم شعرية** (مدرّس، حلقة الهداية) — كلمة المرور `123`.

## الأدوار والصلاحيات (RBAC)

دوران فقط: `ADMIN` و`TEACHER`.

| | ADMIN | TEACHER |
| --- | --- | --- |
| الحلقات | كلها | الحلقات المسندة إليه فقط |
| الطلاب | كلهم | طلاب حلقاته فقط |
| الحضور والتسميع | الكل | حلقاته فقط |
| التقارير ولوحة المعلومات | أرقام كاملة | محصورة بحلقاته |
| إنشاء/تعديل/حذف حلقة | ✔ | ✘ (403) |
| إضافة مستخدم وإسناد الحلقات | ✔ | ✘ (403) |
| الحذف النهائي للطالب | ✔ | ✘ (403) |
| إضافة/خصم النقاط | لأي طالب | لطلاب حلقاته فقط |

**نطاق المدرّس** = الحلقات التي هو أستاذها الأساسي (`halaqat.teacher_id`) + الحلقات المسندة إليه في `teacher_halaqat`. مدرّس بلا أي حلقة لا يرى شيئاً (بدل أن يرى الكل).

التطبيق كله في طبقة الـ API عبر [`src/services/scope.ts`](src/services/scope.ts) — المكافئ لسياسات RLS. القاعدة: **أي مسار يقرأ أو يكتب بيانات حلقة/طالب يمرّ من هناك**؛ إما `applyScope()` لتصفية القوائم، أو `assertHalaqaAccess()` / `assertStudentAccess()` لرمي 403 على السجل المفرد.

## الترقيات (Migrations)

`migrate()` يعمل تلقائياً عند بدء الخادم:

- قاعدة جديدة: يُطبَّق [`schema.sql`](src/db/schema.sql) كاملاً وتُوسم بأحدث إصدار.
- قاعدة قائمة: تُطبَّق ملفات [`src/db/migrations/`](src/db/migrations/) المعلّقة بالترتيب (يتتبّعها `PRAGMA user_version`)، كل ملف في معاملة واحدة.

ترقية `002_username_password.sql` تضيف `username` و`password_hash`. وترقية `001_rbac.sql` تحوّل الأدوار القديمة (`admin`/`supervisor` → `ADMIN`، `teacher` → `TEACHER`) وتنشئ `teacher_halaqat` وتملؤها من الأساتذة الأساسيين. تُعطَّل المفاتيح الأجنبية أثناء الترقية فقط — لأن إعادة بناء جدول مرجعي مع تفعيلها تُفسَّر كحذف صفوف فتُفرَّغ `halaqat.teacher_id` — ويُفحص التكامل بـ`foreign_key_check` بعدها.

## هيكلية قاعدة البيانات

الملف المرجعي: [`src/db/schema.sql`](src/db/schema.sql)

| الجدول | الغرض |
| --- | --- |
| `users` | المشرفون والمدرّسون؛ `username` و`password_hash` للدخول، و`role` بقيمة ADMIN أو TEACHER |
| `teacher_halaqat` | إسناد المدرّسين إلى الحلقات (مدرّس ↔ عدة حلقات) |
| `otp_codes` | رموز التحقق المؤقتة (صلاحية ١٠ دقائق) |
| `halaqat` | الحلقات وأستاذ كل حلقة |
| `students` | الطلاب، مع رصيد النقاط المحسوب |
| `attendance_sessions` | جلسة حضور واحدة لكل حلقة/تاريخ، تشمل حالة الأستاذ |
| `attendance_entries` | حالة كل طالب داخل الجلسة |
| `recitations` | التلاوة والتسميع (النوع، الصفحة، الآية، التقييم، الملاحظات) |
| `point_transactions` | سجل كل إضافة/خصم نقاط، وهو مصدر الحقيقة للرصيد |

قواعد مهمة:

- `UNIQUE (halaqa_id, date)` على الجلسات — إعادة الحفظ لنفس اليوم تُحدِّث ولا تُكرِّر.
- `students.points` مجموع `point_transactions.delta`؛ كل حركة تُقيَّد وتُحدَّث داخل معاملة واحدة.
- تعديل الحضور أو تقييم التسميع يُعيد النقاط القديمة قبل احتساب الجديدة، فلا تتضخّم الأرصدة.
- الحذف افتراضياً تعطيل (`is_active = 0`)؛ الحذف النهائي للطالب يتطلب صلاحية `admin` عبر `?hard=true`.

النقاط التلقائية (قابلة للتعديل في `.env`): حضور `5`، تسميع ممتاز `20`، جيد `12`، يحتاج تحسين `5`.

## نقاط الـ API

كل المسارات تحت `/api`، وكلها تتطلب رأس `Authorization: Bearer <token>` عدا `/auth/*` و`/health`.

### الدخول

| Method | Path | الوصف |
| --- | --- | --- |
| POST | `/auth/login` | الدخول باسم المستخدم وكلمة المرور: `{ username, password }` |
| GET | `/auth/me` | المستخدم الحالي مع `role` و`halaqa_id` و`halaqat` |
| POST | `/auth/request-otp` | (بديل) إرسال رمز تحقق للهاتف |
| POST | `/auth/verify-otp` | (بديل) التحقق وإصدار JWT |

كلمات المرور مجزّأة بـ scrypt المدمج في Node (بلا تبعيات). الاستجابة تحمل `token` و`user`، و`user.halaqa_id` هو حلقة المدرّس التي تُفتح عليها الصفحات تلقائياً (`null` للمشرف).

### الحلقات

| Method | Path | الوصف |
| --- | --- | --- |
| GET | `/halaqat?mine=true` | قائمة الحلقات مع عدد الطلاب |
| GET | `/halaqat/:id` | حلقة واحدة |
| GET | `/halaqat/:id/students` | طلاب الحلقة مع آخر تسميع |
| POST | `/halaqat` | إنشاء (مشرف/مدير) |
| PATCH | `/halaqat/:id` | تعديل (مشرف/مدير) |
| DELETE | `/halaqat/:id` | تعطيل (مدير) |

### الطلاب والنقاط

| Method | Path | الوصف |
| --- | --- | --- |
| GET | `/students?halaqaId=&search=&limit=&offset=` | قائمة مع بحث وترقيم |
| GET | `/students/:id` | ملف الطالب + إحصاءات الحضور والتسميع |
| POST | `/students` | إضافة (الرقم الأكاديمي يُولَّد تلقائياً) |
| PATCH | `/students/:id` | تعديل |
| DELETE | `/students/:id?hard=true` | تعطيل أو حذف نهائي |
| POST | `/students/:id/transfer` | نقل إلى حلقة أخرى |
| GET | `/students/:id/points` | سجل النقاط + الرصيد |
| POST | `/students/:id/points` | إضافة/خصم: `{ amount, operation: "add"\|"deduct", reason }` |

الرصيد لا يمكن أن يصبح سالباً — الخصم الزائد يُرفض بـ `400`.

### الحضور

| Method | Path | الوصف |
| --- | --- | --- |
| GET | `/attendance/halaqat/:halaqaId?date=` | تجهيز شاشة التسجيل (كل الطلاب + حالتهم) |
| POST | `/attendance` | حفظ حضور حلقة في يوم (نفس حِمل شاشة التسجيل) |
| GET | `/attendance/sessions?halaqaId=&from=&to=` | سجل الحضور مجمّعاً بالأيام |
| GET | `/attendance/sessions/:id` | جلسة واحدة |
| PATCH | `/attendance/sessions/:sid/students/:id` | تعديل حالة طالب |
| DELETE | `/attendance/sessions/:sid/students/:id` | حذف طالب من الجلسة |
| DELETE | `/attendance/sessions/:id` | حذف الجلسة كاملة |

مثال الحفظ:

```json
{
  "halaqaId": 1,
  "date": "2026-08-17",
  "teacherStatus": "present",
  "students": [{ "id": 1, "status": "present" }, { "id": 2, "status": "absent" }]
}
```

الحالات المتاحة: `present` / `absent` / `late` / `excused`. إرسال طالب لا ينتمي للحلقة يُرفض بـ `400`.

### التلاوة والتسميع

| Method | Path | الوصف |
| --- | --- | --- |
| GET | `/recitations?studentId=&halaqaId=&from=&to=&rating=` | سجل التلاوة |
| GET | `/recitations/:id` | سجل واحد |
| POST | `/recitations` | تسجيل تلاوة ومنح النقاط |
| PATCH | `/recitations/:id` | تعديل (يعيد احتساب النقاط عند تغيير التقييم) |
| DELETE | `/recitations/:id` | حذف وإعادة النقاط |

التحقق المشروط: النوع `half` يتطلب `verse`، والنوع `more` يتطلب `toPage` أكبر من `pageNumber`.

### التقارير

| Method | Path | الوصف |
| --- | --- | --- |
| GET | `/reports/leaderboard?type=points\|attendance\|recitation` | لوحة الترتيب مع `rank` |
| GET | `/reports/dashboard?date=` | بطاقات الصفحة الرئيسية + آخر النشاطات |
| GET | `/reports/halaqat/:id?from=&to=` | تقرير حلقة |
| GET | `/reports/students/:id?from=&to=` | تقرير طالب مع خط زمني |

لوحة الترتيب تُرجع الأعمدة الثلاثة دائماً (`points` و`attendance` و`recitation`) ويتغيّر الترتيب حسب `type`، فيكفي طلب واحد لتبديل التبويبات. متوسط التسميع محسوب من التقييم: ممتاز ١٠٠، جيد ٨٥، يحتاج تحسين ٦٥. تحديد `from`/`to` يجعل النقاط محسوبة على الفترة بدل الرصيد الكلي.

### المستخدمون

| Method | Path | الوصف |
| --- | --- | --- |
| GET | `/users?role=TEACHER` | قائمة المدرّسين مع عدد حلقات كل واحد |
| POST | `/users` | إضافة مستخدم (ADMIN) |
| PATCH | `/users/:id` | تعديل الاسم أو الدور أو التفعيل (ADMIN) |
| GET | `/users/:id/halaqat` | الحلقات المسندة إلى مدرّس (ADMIN) |
| PUT | `/users/:id/halaqat` | ضبط الإسناد: `{ "halaqaIds": [1, 4] }` — استبدال كامل (ADMIN) |

للدخول كمدرّس: **أيهم شعرية** / `123` — مسند إلى حلقة الهداية.

## شكل الاستجابة

النجاح: `{ "data": ... }` ومعه `meta` عند الترقيم.
الخطأ: `{ "error": "رسالة عربية", "details": [...] }` مع رمز HTTP مناسب (400 تحقق، 401 دخول، 403 صلاحية، 404 غير موجود، 409 تكرار).

## الاستخدام من الواجهة

```ts
import { attendanceApi, studentsApi, reportsApi } from "@/lib/api";

const { data } = await attendanceApi.sheet(halaqaId, date);
await attendanceApi.save({ halaqaId, date, teacherStatus, students });
await studentsApi.addPoints(studentId, 50, "مبادرة");
const { data: rows } = await reportsApi.leaderboard({ type: "points" });
```
