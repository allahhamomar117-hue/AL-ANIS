import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDb, db, migrate } from "./db/index.js";

migrate();

/**
 * فحص سريع بعد الترقية: يمنع اكتشاف نقص المخطط لاحقاً على شكل 500 غامض
 * في منتصف الاستخدام (مثل تسجيل الدخول بلا عمود password_hash).
 */
function verifySchema(): void {
  const required: Record<string, string[]> = {
    users: ["username", "password_hash", "role"],
    teacher_halaqat: ["user_id", "halaqa_id"],
  };

  const missing: string[] = [];

  for (const [table, columns] of Object.entries(required)) {
    const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (info.length === 0) {
      missing.push(`الجدول ${table}`);
      continue;
    }
    const present = new Set(info.map((c) => c.name));
    for (const column of columns) {
      if (!present.has(column)) missing.push(`${table}.${column}`);
    }
  }

  if (missing.length) {
    console.error("✖ مخطط قاعدة البيانات ناقص:", missing.join("، "));
    console.error("  شغّل: npm run db:migrate ثم npm run db:seed");
    process.exit(1);
  }
}

verifySchema();

const server = createApp().listen(config.port, () => {
  console.log(`🕌 الأنيس API يعمل على http://localhost:${config.port}/api`);
  console.log(`   قاعدة البيانات: ${config.dbFile}`);
});

// إيقاف نظيف: نغلق المنفذ وندمج سجل WAL حتى يبقى ملف القاعدة مكتفياً بذاته
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    console.log("\nإيقاف الخادم…");
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  });
}
