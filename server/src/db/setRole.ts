/**
 * ترقية حساب إلى مشرف أو خفضه إلى مدرّس.
 *
 *   npm run user:role                    عرض كل الحسابات وأدوارها
 *   npm run user:role -- "عمار شهوري" ADMIN
 *   npm run user:role -- "أيهم شعرية" TEACHER
 *
 * سبب وجود هذه الأداة: عمود role في جدول users قيمته الافتراضية 'TEACHER'،
 * فأي حساب يُنشأ دون تحديد الدور صراحةً يصير مدرّساً — ومن ثمّ يُرفض بـ403
 * عند تعديل بيانات الطلاب أو رفع صورهم، وهي عمليات للمشرف وحده.
 */
import { db } from "./index.js";

type Role = "ADMIN" | "SUPERVISOR" | "TEACHER";

interface UserRow {
  id: number;
  name: string;
  username: string | null;
  role: Role;
  is_active: number;
}

function listUsers(): void {
  const users = db
    .prepare("SELECT id, name, username, role, is_active FROM users ORDER BY role, name")
    .all() as UserRow[];

  if (users.length === 0) {
    console.log("لا توجد حسابات. شغّل: npm run db:seed");
    return;
  }

  console.log("الحسابات الحالية:\n");
  for (const u of users) {
    const flag = u.role === "ADMIN" ? "★" : " ";
    const inactive = u.is_active ? "" : "  (معطّل)";
    console.log(
      `  ${flag} ${String(u.role).padEnd(8)} ${u.name}` +
        `   [اسم الدخول: ${u.username ?? "—"}]${inactive}`
    );
  }
  console.log(`\n  ★ = مشرف (يملك تعديل الطلاب ورفع الصور)`);
  console.log(`\nللترقية:  npm run user:role -- "اسم الحساب" ADMIN`);
}

function setRole(identifier: string, role: Role): void {
  // يقبل اسم المستخدم أو الاسم الكامل، فالمستخدم قد يعرف أحدهما فقط
  const user = db
    .prepare("SELECT id, name, username, role, is_active FROM users WHERE username = ? OR name = ?")
    .get(identifier, identifier) as UserRow | undefined;

  if (!user) {
    console.error(`لا يوجد حساب باسم: ${identifier}`);
    console.error("");
    listUsers();
    process.exit(1);
  }

  if (user.role === role) {
    console.log(`${user.name} دوره ${role} أصلاً — لا تغيير.`);
    return;
  }

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, user.id);
  console.log(`✔ ${user.name}: ${user.role} → ${role}`);

  if (role === "ADMIN") {
    console.log("  يملك الآن: تعديل الطلاب وإضافتهم وحذفهم، ورفع الصور، ورؤية كل الحلقات.");
  }
  console.log("\n  سجّل الخروج ثم الدخول من جديد ليأخذ المتصفح الدور الجديد.");
}

const [identifier, roleArg] = process.argv.slice(2);

if (!identifier) {
  listUsers();
} else if (roleArg !== "ADMIN" && roleArg !== "SUPERVISOR" && roleArg !== "TEACHER") {
  console.error('الدور يجب أن يكون ADMIN أو SUPERVISOR أو TEACHER.');
  console.error('مثال:  npm run user:role -- "عمار شهوري" ADMIN');
  process.exit(1);
} else {
  setRole(identifier, roleArg);
}
