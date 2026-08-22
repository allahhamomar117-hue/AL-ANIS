/**
 * تهيئة المخطط.
 *
 * SQLite يحتفظ بآلية الترقيات الكاملة (user_version + migrations/) لأن
 * نسخ العرض والتطوير قد تحمل قواعد قائمة من إصدارات سابقة.
 *
 * Postgres يبدأ من schema.pg.sql مباشرة: قاعدة Supabase تُنشأ جديدة،
 * والترقيات السبع كانت تُصلح مخطط SQLite قديماً فنتيجتها النهائية هي
 * ما يحمله ملف المخطط أصلاً.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { db, initDb } from "./driver.js";

export { db, initDb, closeDb } from "./driver.js";
export type { DbDriver, RunResult, SqlParam } from "./driver.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "migrations");

/** ترتيب الترقيات: اسم الملف يبدأ برقمه (001_…‎). */
function pendingMigrations(from: number): { version: number; file: string }[] {
  if (!fs.existsSync(migrationsDir)) return [];

  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((file) => ({ version: Number(file.split("_")[0]), file }))
    .filter((m) => Number.isFinite(m.version) && m.version > from)
    .sort((a, b) => a.version - b.version);
}

/** أعلى إصدار متاح — قواعد البيانات الجديدة تبدأ منه مباشرة. */
function latestVersion(): number {
  const all = pendingMigrations(0);
  return all.length ? all[all.length - 1].version : 0;
}

/** ينشئ الاتصال ثم يطبّق المخطط المناسب للهجة. آمن للتشغيل المتكرر. */
export async function migrate(): Promise<void> {
  const driver = await initDb();

  if (driver.dialect === "postgres") {
    await driver.exec(fs.readFileSync(config.schemaFilePg, "utf8"));
    console.log("✔ طُبِّق مخطط PostgreSQL");
    return;
  }

  migrateSqlite();
}

/**
 * ترقية SQLite. تعمل على المقبض الخام لأنها تعتمد على PRAGMA وعلى
 * ترتيب صارم لا يحتمل تداخل الوعود.
 */
function migrateSqlite(): void {
  const raw = db().raw;
  if (!raw) throw new Error("ترقية SQLite تتطلّب مقبضاً خاماً");

  const isNew =
    raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get() === undefined;

  const schema = fs.readFileSync(config.schemaFile, "utf8");

  if (isNew) {
    raw.exec(schema);
    raw.pragma(`user_version = ${latestVersion()}`);
    raw.pragma("wal_checkpoint(TRUNCATE)");
    return;
  }

  const current = Number((raw.pragma("user_version", { simple: true }) as number) ?? 0);
  const pending = pendingMigrations(current);

  if (pending.length) {
    // إعادة بناء جدول مرجعي (DROP/RENAME) مع تفعيل المفاتيح الأجنبية
    // تُفسَّر كحذف صفوف فتُفرَّغ المراجع؛ لذا نعطّلها أثناء الترقية فقط.
    // PRAGMA foreign_keys لا يعمل داخل معاملة، فيجب ضبطه خارجها.
    raw.pragma("foreign_keys = OFF");

    try {
      for (const migration of pending) {
        const sql = fs.readFileSync(path.join(migrationsDir, migration.file), "utf8");

        // الترقية كلها في معاملة واحدة: إما أن تكتمل أو لا شيء
        raw.exec("BEGIN");
        try {
          raw.exec(sql);
          raw.pragma(`user_version = ${migration.version}`);
          raw.exec("COMMIT");
          console.log(`✔ ترقية القاعدة: ${migration.file}`);
        } catch (error) {
          raw.exec("ROLLBACK");
          throw new Error(`فشلت الترقية ${migration.file}: ${(error as Error).message}`);
        }
      }

      const violations = raw.pragma("foreign_key_check") as unknown[];
      if (violations.length) {
        throw new Error(`الترقية أنتجت مراجع غير صالحة: ${JSON.stringify(violations)}`);
      }
    } finally {
      raw.pragma("foreign_keys = ON");
    }
  }

  raw.exec(schema);

  // نضمن أن ملف القاعدة نفسه يحمل المخطط بعد الترقية
  raw.pragma("wal_checkpoint(TRUNCATE)");
}

/** يغلّف دالة في معاملة (transaction) واحدة. */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  return db().tx(() => fn());
}
