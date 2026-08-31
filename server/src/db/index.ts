/**
 * تهيئة المخطط.
 *
 * SQLite يحتفظ بآلية الترقيات الكاملة (user_version + migrations/) لأن
 * نسخ العرض والتطوير قد تحمل قواعد قائمة من إصدارات سابقة.
 *
 * Postgres يطبّق schema.pg.sql ثم fixups.pg.sql — لا يمرّ بـ migrations/‎
 * لأن تلك الترقيات مكتوبة بلهجة SQLite وتُدار بـ user_version الذي لا
 * وجود له هنا.
 *
 * كان يُفترض أن قاعدة Postgres تُنشأ جديدة فيكفيها ملفّ المخطّط وحده.
 * وقد كذّب الواقع هذا الافتراض: قاعدة الإنتاج جاءت بأعمدة تاريخ نصّية
 * لا date، لأن `CREATE TABLE IF NOT EXISTS` ينشئ الناقص ولا يصحّح
 * القائم — فقاعدة أُنشئت من إصدار أقدم تبقى على أنواعه مهما أُعيد
 * تطبيق الملف. fixups.pg.sql هو ما يسدّ هذه الثغرة.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { logSqlError } from "../lib/http.js";
import { db, initDb, type DbDriver } from "./driver.js";

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
    await applyPgSchema(driver);

    await applyPgFixups(driver);
    return;
  }

  migrateSqlite();
}

/**
 * يقسّم نصّ SQL إلى عبارات عند `;` من المستوى الأعلى.
 *
 * المقسّم يعرف ما لا يجوز الشطر داخله: النصوص المقتبسة (`'…'`)،
 * والمعرّفات المقتبسة (`"…"`)، والتعليقات السطرية والكتلية، والاقتباس
 * الدولاري (`$$…$$` و `$tag$…$tag$`) الذي تُكتب به كتل DO — وفيه
 * فواصل منقوطة كثيرة، فالشطر الساذج على `;` يمزّقها.
 *
 * تُستعمل لملفّ المخطّط وحده؛ التصحيحات تُقسَّم بعلامات صريحة لأن كتلها
 * وحدات دلالية لا عبارات مفردة.
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;

  while (i < sql.length) {
    const rest = sql.slice(i);

    // تعليق سطري
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // تعليق كتلي
    if (rest.startsWith("/*")) {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // اقتباس دولاري: $$ أو $tag$
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // نصّ أو معرّف مقتبس
    if (rest[0] === "'" || rest[0] === '"') {
      const q = rest[0];
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === q) {
          // اقتباس مضاعف داخل النصّ ('' أو "") يعني حرفاً لا نهاية
          if (sql[j + 1] === q) { j += 2; continue; }
          j++;
          break;
        }
        j++;
      }
      buf += sql.slice(i, j);
      i = j;
      continue;
    }

    if (rest[0] === ";") {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      i++;
      continue;
    }

    buf += rest[0];
    i++;
  }

  if (buf.trim()) out.push(buf.trim());

  // عبارة بلا شيء سوى التعليقات ليست عبارة
  return out.filter((s) => s.split("\n").some((l) => l.trim() && !l.trim().startsWith("--")));
}

/**
 * تطبيق مخطّط Postgres — عبارةً عبارة، لا الملفَّ دفعةً واحدة.
 *
 * ── العلّة التي أوقفت الإنتاج ────────────────────────────────────────
 * ملفّ المخطّط مبنيّ على `CREATE TABLE IF NOT EXISTS`، فيُظنّ أنه آمن
 * على قاعدة قائمة. وليس كذلك: الشرط على *الجدول* لا على *أعمدته*. فجدول
 * قائم يُتخطّى إنشاؤه فلا يُضاف إليه عمود جديد، ثم يأتي
 * `CREATE INDEX IF NOT EXISTS` على ذلك العمود — وهو غير مشروط بوجوده —
 * فيسقط بـ `column "…" does not exist`.
 *
 * وقد وقع هذا بعمود department: أُلغي الملفّ كلّه (عبارات الملف الواحد
 * تُنفَّذ في معاملة ضمنية واحدة)، وخرج الاستثناء من migrate() فأسقط
 * الإقلاع — و fixups.pg.sql الذي كان سيضيف العمود لم يُنفَّذ أصلاً.
 * فالخطأ منع علاجَ نفسه.
 *
 * العزل هنا يقطع هذا كلّه: الجداول تُنشأ، والعبارة المعطوبة وحدها تسقط
 * وتُسجَّل، ثم تعمل التصحيحات فتضيف العمود وفهرسه. والقرار في كون النقص
 * مؤثّراً متروك لـ verifySchema في index.ts — فهو وحده يعرف ما يحتاجه
 * الكود فعلاً.
 */
async function applyPgSchema(driver: DbDriver): Promise<void> {
  const statements = splitSqlStatements(fs.readFileSync(config.schemaFilePg, "utf8"));
  let failed = 0;

  for (const statement of statements) {
    try {
      await driver.exec(statement);
    } catch (error) {
      failed++;
      // أول سطر غير تعليق يكفي للتعريف بالعبارة دون إغراق السجلّ
      const head = statement
        .split("\n")
        .find((l) => l.trim() && !l.trim().startsWith("--"))
        ?.trim();
      logSqlError(`مخطط PostgreSQL: ${head ?? "عبارة"}`, error);
    }
  }

  console.log(
    failed === 0
      ? `✔ طُبِّق مخطط PostgreSQL (${statements.length} عبارة)`
      : `⚠ مخطط PostgreSQL: نجحت ${statements.length - failed} من ${statements.length} — راجع الأخطاء أعلاه`
  );
}

/**
 * يقسّم ملفّ التصحيحات إلى كتل عند سطور `-- @fixup <اسم>`.
 *
 * القسمة بعلامة صريحة لا بتحليل SQL: الملف فيه كتل `DO $ … $` تحتوي
 * فواصل منقوطة داخلها، وأي شطر على `;` يمزّقها. والعلامة تعطي كل كتلة
 * اسماً يُطبع في السجلّ، فيُعرف أيّها فشل دون قراءة الملف.
 */
function splitFixups(sql: string): { name: string; body: string }[] {
  const parts = sql.split(/^-- @fixup +(.+)$/m);

  // ما قبل أول علامة تعليقٌ افتتاحي لا تصحيح — يُهمَل
  const blocks: { name: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const body = parts[i + 1] ?? "";
    if (body.trim()) blocks.push({ name: parts[i].trim(), body });
  }
  return blocks;
}

/**
 * تطبيق تصحيحات Postgres — كتلةً كتلةً، لا الملفَّ دفعةً واحدة.
 *
 * ── لماذا كتلةً كتلةً؟ (علّة أوقفت الإنتاج فعلاً) ────────────────────
 * `query()` بنصٍّ متعدّد العبارات يستعمل بروتوكول الاستعلام البسيط، وفيه
 * تُنفَّذ عبارات النصّ كلّها داخل معاملة ضمنية واحدة. فعبارةٌ واحدة تفشل
 * في آخر الملف تُلغي ما قبلها كلَّه — بما فيه إضافة أعمدة لا علاقة لها
 * بها. وهذا ما حدث: أُلغيت `ADD COLUMN department` بسبب فشلٍ في كتلة
 * أخرى، فأقلع الخادم على مخطّط ناقص وسقط عند أول استعلام يمسّ العمود
 * برسالة `column "department" does not exist` لا تدلّ على السبب أصلاً.
 *
 * الآن لكل كتلة استدعاؤها ومعاملتها الضمنية: فشلُ إحداها لا يمسّ سواها،
 * واسمها يُطبع في السجلّ فيُعرف الجاني من أول سطر.
 *
 * ── ولماذا يبقى الفشل غير قاتل هنا؟ ─────────────────────────────────
 * لأن الحراسة انتقلت إلى موضعها الصحيح: verifySchema في index.ts يفحص
 * الأعمدة الفعلية بعد الترقية ويُسقط الإقلاع برسالة تصف الإصلاح. فالفشل
 * هنا يُسجَّل، والقرار هناك — حيث يُعرف ما إذا كان النقص مؤثّراً حقاً.
 */
async function applyPgFixups(driver: DbDriver): Promise<void> {
  const blocks = splitFixups(fs.readFileSync(config.fixupsFilePg, "utf8"));

  if (blocks.length === 0) {
    console.warn("⚠ ملفّ التصحيحات بلا كتل معلَّمة بـ '-- @fixup' — لم يُطبَّق شيء");
    return;
  }

  let failed = 0;

  for (const block of blocks) {
    try {
      await driver.exec(block.body);
    } catch (error) {
      failed++;
      logSqlError(`تصحيح PostgreSQL: ${block.name}`, error);
      console.warn(`⚠ تُخطّي التصحيح "${block.name}" — بقيّة التصحيحات تُطبَّق`);
    }
  }

  console.log(
    failed === 0
      ? `✔ فُحصت تصحيحات مخطط PostgreSQL (${blocks.length} كتلة)`
      : `⚠ تصحيحات PostgreSQL: نجحت ${blocks.length - failed} من ${blocks.length}`
  );
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
