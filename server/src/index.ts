import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDb, db, migrate } from "./db/index.js";
import { seedDemo } from "./db/seed-demo.js";

/**
 * بذرة العرض عند الإقلاع.
 *
 * قرص Railway/Render مؤقّت: ملف SQLite يُمسح مع كل إعادة نشر، فتقلع نسخة
 * العرض بقاعدة فارغة ولا يوجد حساب يُسجَّل به الدخول. لذا نزرعها هنا —
 * لكن فقط إن كانت القاعدة فارغة فعلاً، حتى لا تُمحى بيانات أُدخلت أثناء
 * العرض مع كل إعادة تشغيل. SEED_DEMO_FORCE=true يفرض إعادة البناء.
 *
 * الحارس مزدوج (SEED_DEMO_ON_START + فراغ القاعدة) لأن الدالة تمسح كل شيء؛
 * لا يُفعَّل المتغيّر إطلاقاً على نسخة المسجد الحقيقية.
 */
async function seedDemoIfNeeded(): Promise<void> {
  if (!config.seedDemoOnStart && !config.seedDemoForce) return;

  const row = await db().get<{ users: number }>("SELECT COUNT(*) AS users FROM users");
  const users = row?.users ?? 0;

  if (users > 0 && !config.seedDemoForce) {
    console.log(`↷ تخطّي بذرة العرض: القاعدة تحتوي ${users} حساباً أصلاً.`);
    return;
  }

  console.log("🌱 تجهيز بيانات العرض…");
  await seedDemo();
}

/**
 * فحص سريع بعد الترقية: يمنع اكتشاف نقص المخطط لاحقاً على شكل 500 غامض
 * في منتصف الاستخدام (مثل تسجيل الدخول بلا عمود password_hash).
 */
async function verifySchema(): Promise<void> {
  const required: Record<string, string[]> = {
    users: ["username", "password_hash", "role"],
    teacher_halaqat: ["user_id", "halaqa_id"],
  };

  const missing: string[] = [];

  for (const [table, columns] of Object.entries(required)) {
    // لكل لهجة طريقها: SQLite عبر PRAGMA، و Postgres عبر information_schema
    // (لا وجود لأيّهما عند الآخر). اسم الجدول ثابت في الكود لا مُدخَل مستخدم.
    const info =
      db().dialect === "postgres"
        ? await db().all<{ name: string }>(
            `SELECT column_name AS name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = ?`,
            [table]
          )
        : await db().all<{ name: string }>(`PRAGMA table_info(${table})`);

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

async function main(): Promise<void> {
  await migrate();
  await seedDemoIfNeeded();
  await verifySchema();

  const server = createApp().listen(config.port, () => {
    console.log(`🕌 الأنيس API يعمل على http://localhost:${config.port}/api`);
    console.log(`   قاعدة البيانات: ${config.databaseUrl ? "PostgreSQL" : config.dbFile}`);
  });

  // إيقاف نظيف: نغلق المنفذ وننهي الاتصال بالقاعدة
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      console.log("\nإيقاف الخادم…");
      server.close(() => {
        void closeDb().then(() => process.exit(0));
      });
    });
  }
}

main().catch((error) => {
  console.error("✖ فشل إقلاع الخادم:", error);
  process.exit(1);
});
