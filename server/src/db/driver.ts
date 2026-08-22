/**
 * طبقة قاعدة بيانات موحّدة: PostgreSQL في الإنتاج، SQLite للعرض والتطوير.
 *
 * الاختيار بمتغيّر واحد: وجود DATABASE_URL ⇒ Postgres، غيابه ⇒ ملف SQLite.
 * لا يوجد إعداد آخر يجب تغييره، فتبقى نسخة الـ Demo المرفوعة تعمل كما هي.
 *
 * ── لماذا الواجهة غير متزامنة (async)؟ ──────────────────────────────
 * better-sqlite3 متزامن (‏`stmt.get()` يُرجع الصف مباشرة) بينما سائق
 * Postgres غير متزامن حتماً — الشبكة لا تُقرأ بشكل متزامن. لا توجد طريقة
 * أمينة لإخفاء ذلك، فالواجهة هنا `Promise` في الحالتين: مسار SQLite يلفّ
 * النتيجة المتزامنة في Promise جاهز (بلا كلفة فعلية)، ومسار Postgres
 * ينتظر الشبكة.
 *
 * ── علامات المعاملات (placeholders) ─────────────────────────────────
 * تُكتب الاستعلامات بأسلوب SQLite‏ (`?`) في كل مكان، ويترجمها مسار
 * Postgres إلى `$1, $2, …` تلقائياً. المعاملات المسمّاة (‏`@name`) الخاصة
 * بـ better-sqlite3 غير مدعومة هنا لأن pg لا يعرفها — استُبدلت كلها
 * بمعاملات مرتّبة.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";

export type SqlParam = string | number | bigint | boolean | null | Buffer;
export type Row = Record<string, unknown>;

/** نتيجة أمر كتابة. `lastInsertRowid` صالح فقط لعمليات الإدراج. */
export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface DbDriver {
  /** الصف الأول أو undefined. */
  get<T = Row>(sql: string, params?: SqlParam[]): Promise<T | undefined>;
  /** كل الصفوف. */
  all<T = Row>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /** أمر كتابة (INSERT/UPDATE/DELETE). */
  run(sql: string, params?: SqlParam[]): Promise<RunResult>;
  /** تنفيذ سكربت SQL خام (مخطط، ترقيات). */
  exec(sql: string): Promise<void>;
  /** تنفيذ دالة داخل معاملة واحدة — تُلغى كاملةً عند أي خطأ. */
  tx<T>(fn: (t: DbDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly dialect: "sqlite" | "postgres";
  /** مقبض better-sqlite3 الخام — لترقيات SQLite وحدها، غائب في Postgres. */
  readonly raw?: Database.Database;
}

/** يحوّل `?` إلى `$1, $2, …`، متجاهلاً ما داخل النصوص المقتبسة. */
export function toPgPlaceholders(sql: string): string {
  let index = 0;
  let quote: "'" | '"' | null = null;
  let out = "";

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (quote) {
      out += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      out += char;
      continue;
    }

    out += char === "?" ? `$${++index}` : char;
  }

  return out;
}

// ── SQLite ───────────────────────────────────────────────────────────

/**
 * better-sqlite3 يرفض القيم المنطقية ("can only bind numbers, strings,
 * bigints, buffers, and null"). الكود يمرّر true/false لأن أعمدة Postgres
 * من نوع boolean لا تقبل 0/1، فنترجمها هنا عند حدود السائق بدل أن يتفرّع
 * كل موضع استدعاء على اللهجة.
 */
function toSqliteParams(params: SqlParam[]): SqlParam[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

function createSqliteDriver(): DbDriver {
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

  const database = new Database(config.dbFile);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  const driver: DbDriver = {
    dialect: "sqlite",
    raw: database,

    async get<T>(sql: string, params: SqlParam[] = []) {
      return database.prepare(sql).get(...toSqliteParams(params)) as T | undefined;
    },

    async all<T>(sql: string, params: SqlParam[] = []) {
      return database.prepare(sql).all(...toSqliteParams(params)) as T[];
    },

    async run(sql: string, params: SqlParam[] = []) {
      const info = database.prepare(sql).run(...toSqliteParams(params));
      return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
    },

    async exec(sql: string) {
      database.exec(sql);
    },

    /**
     * لا نستخدم database.transaction() لأنها ترفض الدوال غير المتزامنة؛
     * نُصرّح بالمعاملة يدوياً بدل ذلك. SQLite لا يدعم المعاملات المتداخلة،
     * والعدّاد يجعل النداء الداخلي ينضمّ إلى المعاملة الجارية.
     */
    async tx<T>(fn: (t: DbDriver) => Promise<T>) {
      if (txDepth > 0) return fn(driver);

      database.exec("BEGIN");
      txDepth++;
      try {
        const result = await fn(driver);
        database.exec("COMMIT");
        return result;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      } finally {
        txDepth--;
      }
    },

    async close() {
      try {
        database.pragma("wal_checkpoint(TRUNCATE)");
      } catch (error) {
        console.warn("تعذّر دمج سجل WAL:", (error as Error).message);
      }
      database.close();
    },
  };

  return driver;
}

let txDepth = 0;

// ── PostgreSQL ───────────────────────────────────────────────────────

/**
 * مواءمة أنواع pg مع ما كان يعيده SQLite، حتى لا تتغيّر أشكال ردود الـ API.
 *
 * بلا هذا تنكسر الواجهة بصمت: التواريخ تعود ككائنات Date فتُسلسَل إلى
 * ISO كامل بدل "YYYY-MM-DD"، و COUNT(*) يعود كنصّ لأن bigint لا يتّسع
 * في رقم JavaScript، و SUM يعود كنصّ أيضاً لأنه numeric.
 */
function configurePgTypes(types: {
  setTypeParser(id: number, fn: (value: string) => unknown): void;
}): void {
  const DATE = 1082;
  const TIMESTAMP = 1114;
  const TIMESTAMPTZ = 1184;
  const INT8 = 20;
  const NUMERIC = 1700;

  // التواريخ تبقى نصوصاً كما كانت تُخزَّن في SQLite
  types.setTypeParser(DATE, (v) => v);
  types.setTypeParser(TIMESTAMP, (v) => v);
  types.setTypeParser(TIMESTAMPTZ, (v) => v);

  // COUNT/SUM: أرقام لا نصوص
  types.setTypeParser(INT8, (v) => Number(v));
  types.setTypeParser(NUMERIC, (v) => Number(v));
}

/**
 * جداول بلا عمود id — مفتاحها الأساسي مركّب.
 *
 * إلحاق `RETURNING id` بها يُسقط الأمر بخطأ 42703 (عمود غير معروف)، وهو
 * ما كان سيكسر كل إسناد أستاذ إلى حلقة على Postgres وحده.
 */
const ID_LESS_TABLES = new Set(["teacher_halaqat"]);

/** اسم الجدول المستهدَف في أمر INSERT، أو null إن لم يكن أمر إدراج. */
function insertTarget(sql: string): string | null {
  const match = /^\s*insert\s+into\s+"?([a-z_][a-z0-9_]*)"?/i.exec(sql);
  return match ? match[1].toLowerCase() : null;
}

/**
 * المنطقيات كانت تُخزَّن في SQLite أعداداً (0/1) وتصل الواجهة كذلك،
 * بينما يعيدها Postgres true/false. نعيدها إلى 0/1 حفاظاً على العقد
 * القائم مع الواجهة (‏`is_active`، `page_completed`).
 */
function normalizeRow(row: Row): Row {
  for (const key of Object.keys(row)) {
    if (typeof row[key] === "boolean") row[key] = row[key] ? 1 : 0;
  }
  return row;
}

async function createPostgresDriver(connectionString: string): Promise<DbDriver> {
  const pg = await import("pg");
  const { Pool, types } = pg.default ?? pg;

  configurePgTypes(types);

  /**
   * Supabase يقدّم الاتصال عبر شهادة موقّعة من مرجع غير موجود في متجر
   * Node الافتراضي، فيفشل التحقّق. rejectUnauthorized=false يُبقي
   * الاتصال مشفّراً مع تعطيل التحقّق من سلسلة الشهادات — وهو ما توصي
   * به Supabase ما لم تُزوَّد شهادة الجذر يدوياً.
   */
  const pool = new Pool({
    connectionString,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: config.databasePoolMax,
  });

  type Executor = { query(text: string, values?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }> };

  /** يبني سائقاً فوق مُنفِّذ واحد (المجمّع أو عميل معاملة). */
  function wrap(executor: Executor, inTransaction: boolean): DbDriver {
    const self: DbDriver = {
      dialect: "postgres",

      async get<T>(sql: string, params: SqlParam[] = []) {
        const result = await executor.query(toPgPlaceholders(sql), params);
        const row = result.rows[0];
        return (row ? normalizeRow(row) : undefined) as T | undefined;
      },

      async all<T>(sql: string, params: SqlParam[] = []) {
        const result = await executor.query(toPgPlaceholders(sql), params);
        return result.rows.map(normalizeRow) as T[];
      },

      /**
       * Postgres لا يعرف lastInsertRowid؛ نُلحق RETURNING id بأوامر
       * الإدراج التي لا تحملها أصلاً لنستخرج المعرّف من الصف العائد.
       * ON CONFLICT DO NOTHING قد لا يُدرج شيئاً فلا يعود صف — وهذا
       * متوقَّع، ويقابل changes = 0.
       */
      async run(sql: string, params: SqlParam[] = []) {
        const target = insertTarget(sql);
        const wantsId =
          target !== null && !ID_LESS_TABLES.has(target) && !/\breturning\b/i.test(sql);
        const text = wantsId ? `${sql} RETURNING id` : sql;

        const result = await executor.query(toPgPlaceholders(text), params);
        const id = result.rows[0]?.id;

        return {
          changes: result.rowCount ?? 0,
          lastInsertRowid: typeof id === "number" ? id : Number(id ?? 0),
        };
      },

      async exec(sql: string) {
        await executor.query(sql);
      },

      async tx<T>(fn: (t: DbDriver) => Promise<T>) {
        // معاملة متداخلة: ننفّذ داخل المعاملة الجارية بدل فتح أخرى
        if (inTransaction) return fn(self);

        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(wrap(client, true));
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      },

      async close() {
        await pool.end();
      },
    };

    return self;
  }

  return wrap(pool, false);
}

// ── الاختيار ─────────────────────────────────────────────────────────

let instance: DbDriver | null = null;

/**
 * ينشئ الاتصال. يُستدعى مرّة واحدة عند إقلاع الخادم قبل أي استعلام.
 *
 *   DATABASE_URL موجود ⇒ PostgreSQL (‏Supabase)
 *   غير موجود          ⇒ SQLite في config.dbFile (نسخة العرض)
 */
export async function initDb(): Promise<DbDriver> {
  if (instance) return instance;

  if (config.databaseUrl) {
    console.log("🗄  قاعدة البيانات: PostgreSQL");
    instance = await createPostgresDriver(config.databaseUrl);
  } else {
    console.log(`🗄  قاعدة البيانات: SQLite (${config.dbFile})`);
    instance = createSqliteDriver();
  }

  return instance;
}

/**
 * السائق النشط. متزامن عمداً حتى تبقى مواضع الاستدعاء `db().get(...)`
 * بلا await مزدوج؛ الاتصال نفسه أُنشئ مسبقاً في initDb.
 */
export function db(): DbDriver {
  if (!instance) {
    throw new Error("قاعدة البيانات لم تُهيَّأ بعد — استدعِ initDb() عند الإقلاع.");
  }
  return instance;
}

/** إغلاق نظيف عند إيقاف الخادم. */
export async function closeDb(): Promise<void> {
  if (!instance) return;
  await instance.close();
  instance = null;
}
