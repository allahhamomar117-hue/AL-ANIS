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
 *
 * ── لماذا يجب أن تُذكر هنا كل أعمدة الترقيات؟ ────────────────────────
 * تصحيحات Postgres غير قاتلة بذاتها (applyPgFixups يسجّل ويمضي)، فهذه
 * الدالة هي الحارس الوحيد بينها وبين خدمةٍ تعمل على مخطّط ناقص.
 *
 * وقد سقطت مرّة لهذا السبب: أُضيف عمود department ولم يُذكر هنا، ففشل
 * تصحيحه صامتاً وأقلع الخادم، ثم مات عند أول استعلام مقسوم برسالة
 * `column "department" does not exist` — رسالةٌ تصف العَرَض ولا تدلّ على
 * الدواء. المطلوب أن يتوقّف الإقلاع هنا برسالةٍ تقول ما يُفعل.
 *
 * ⚠ كل ترقية تضيف عموداً يعتمد عليه الكود: أضِف العمود إلى هذه القائمة
 *   في نفس الالتزام (commit)، لا بعده.
 */
async function verifySchema(): Promise<void> {
  const required: Record<string, string[]> = {
    users: ["username", "password_hash", "role", "department"],
    halaqat: ["department"],
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

    if (db().dialect === "postgres") {
      /*
       * على Postgres النقصُ يعني أن تصحيحاً في fixups.pg.sql فشل — وقد
       * طُبع خطؤه كاملاً قبل هذا السطر مباشرةً. الإحالة إليه أنفع من
       * db:migrate الذي أُجري للتوّ ولن يغيّر شيئاً بإعادته.
       */
      console.error("");
      console.error("  السبب: فشل تصحيح في fixups.pg.sql — راجع الخطأ المطبوع أعلاه.");
      console.error("  الإصلاح العاجل: نفّذ الكتلة الناقصة يدوياً في محرّر SQL");
      console.error("  (Railway/Supabase)، ثم أعد تشغيل الخدمة:");
      console.error("");
      console.error("    ALTER TABLE users   ADD COLUMN IF NOT EXISTS department TEXT;");
      console.error("    ALTER TABLE halaqat ADD COLUMN IF NOT EXISTS department TEXT;");
      console.error("");
    } else {
      console.error("  شغّل: npm run db:migrate ثم npm run db:seed");
    }

    process.exit(1);
  }

  await verifyBooleanColumns();
}

/**
 * الأعمدة المنطقية في Postgres يجب أن تكون boolean لا integer.
 *
 * قاعدة منقولة من SQLite بأداة ترحيل تُبقيها integer، فتسقط أول مقارنة
 * (‏`is_active = TRUE`) بخطأ «operator does not exist: integer = boolean» —
 * وهو خطأ يظهر عند تسجيل الدخول فيبدو وكأنه عطل في المصادقة لا في المخطط.
 * الفحص هنا يكشفه عند الإقلاع ويصف الإصلاح بدل أن يُترك للتخمين.
 */
async function verifyBooleanColumns(): Promise<void> {
  if (db().dialect !== "postgres") return;

  const expected: [table: string, column: string][] = [
    ["users", "is_active"],
    ["students", "is_active"],
    ["halaqat", "is_active"],
    ["recitations", "page_completed"],
  ];

  const rows = await db().all<{ table_name: string; column_name: string; data_type: string }>(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name IN ('is_active', 'page_completed')`
  );

  const typeOf = new Map(rows.map((r) => [`${r.table_name}.${r.column_name}`, r.data_type]));
  const wrong = expected
    .map(([table, column]) => ({ key: `${table}.${column}`, type: typeOf.get(`${table}.${column}`) }))
    .filter((c) => c.type !== undefined && c.type !== "boolean");

  if (wrong.length === 0) return;

  console.error("✖ أعمدة منطقية بنوع خاطئ في PostgreSQL:");
  for (const c of wrong) console.error(`    ${c.key} — النوع الحالي: ${c.type}، المتوقَّع: boolean`);
  console.error("");
  console.error("  السبب: القاعدة نُقلت من SQLite فبقيت أعمدة 0/1 أعداداً.");
  console.error("  الإصلاح: نفّذ server/scripts/fix-boolean-columns.sql في Supabase SQL Editor.");
  process.exit(1);
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
