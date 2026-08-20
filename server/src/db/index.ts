import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "../config.js";

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new Database(config.dbFile);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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

/**
 * ينشئ الجداول ويطبّق الترقيات. آمن للتشغيل المتكرر.
 *
 * - قاعدة جديدة: يُطبَّق schema.sql كاملاً ويُوسم بأحدث إصدار.
 * - قاعدة قائمة: تُطبَّق الترقيات المعلّقة بالترتيب، ثم schema.sql
 *   لإضافة أي جداول أو فهارس جديدة (كلها CREATE ... IF NOT EXISTS).
 */
export function migrate(): void {
  const isNew =
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get() === undefined;

  const schema = fs.readFileSync(config.schemaFile, "utf8");

  if (isNew) {
    db.exec(schema);
    db.pragma(`user_version = ${latestVersion()}`);
    db.pragma("wal_checkpoint(TRUNCATE)");
    return;
  }

  const current = Number((db.pragma("user_version", { simple: true }) as number) ?? 0);
  const pending = pendingMigrations(current);

  if (pending.length) {
    // إعادة بناء جدول مرجعي (DROP/RENAME) مع تفعيل المفاتيح الأجنبية
    // تُفسَّر كحذف صفوف فتُفرَّغ المراجع؛ لذا نعطّلها أثناء الترقية فقط.
    // PRAGMA foreign_keys لا يعمل داخل معاملة، فيجب ضبطه خارجها.
    db.pragma("foreign_keys = OFF");

    try {
      for (const migration of pending) {
        const sql = fs.readFileSync(path.join(migrationsDir, migration.file), "utf8");

        // الترقية كلها في معاملة واحدة: إما أن تكتمل أو لا شيء
        db.exec("BEGIN");
        try {
          db.exec(sql);
          db.pragma(`user_version = ${migration.version}`);
          db.exec("COMMIT");
          console.log(`✔ ترقية القاعدة: ${migration.file}`);
        } catch (error) {
          db.exec("ROLLBACK");
          throw new Error(`فشلت الترقية ${migration.file}: ${(error as Error).message}`);
        }
      }

      const violations = db.pragma("foreign_key_check") as unknown[];
      if (violations.length) {
        throw new Error(`الترقية أنتجت مراجع غير صالحة: ${JSON.stringify(violations)}`);
      }
    } finally {
      db.pragma("foreign_keys = ON");
    }
  }

  db.exec(schema);

  // نضمن أن ملف القاعدة نفسه يحمل المخطط بعد الترقية
  db.pragma("wal_checkpoint(TRUNCATE)");
}

/**
 * يدمج سجل WAL في ملف قاعدة البيانات.
 *
 * في وضع WAL تبقى آخر التغييرات (بما فيها الترقيات) في ملف `-wal` منفصل،
 * فإن نُسخ `anis.db` وحده أو فُقد الـ WAL ظهرت القاعدة وكأنها لم تُرقَّ —
 * وهو ما يُنتج أخطاء غامضة مثل "no such column: password_hash".
 */
export function checkpoint(): void {
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch (error) {
    console.warn("تعذّر دمج سجل WAL:", (error as Error).message);
  }
}

/** إغلاق نظيف: دمج السجل ثم إقفال الاتصال. */
export function closeDb(): void {
  checkpoint();
  db.close();
}

/** يغلّف دالة في معاملة (transaction) واحدة. */
export function tx<T>(fn: () => T): T {
  return db.transaction(fn)();
}
