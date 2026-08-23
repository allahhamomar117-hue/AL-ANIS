/**
 * تعيين كلمات مرور لحسابات الكادر دفعةً واحدة.
 *
 *   npm run user:password                 يقرأ passwords.local.json
 *   npm run user:password -- ملف.json     يقرأ ملفاً آخر
 *   npm run user:password -- --check      يعرض ما سيحدث بلا كتابة
 *
 * صيغة الملف — اسم الدخول: كلمة المرور الجديدة:
 *
 *   {
 *     "huthaifa": "…",
 *     "fouad":    "…"
 *   }
 *
 * ── لماذا ملف منفصل لا قيم داخل السكربت؟ ────────────────────────────
 * كتابة كلمات المرور في ملف مصدريّ تُدخلها في تاريخ Git إلى الأبد، وهو
 * أسوأ من الكلمة الموحّدة التي تريد استبدالها. الملف هنا خارج المستودع
 * (‏.gitignore) ويُحذف بعد الاستعمال، والسكربت يرفض العمل إن وجده متعقَّباً.
 *
 * تمرير الكلمات في سطر الأوامر مرفوض للسبب نفسه: يبقى في تاريخ الطرفية
 * وفي قائمة العمليات الجارية.
 *
 * ── الأمان أثناء التنفيذ ────────────────────────────────────────────
 * - التجزئة بنفس hashPassword المستعمل في تسجيل الدخول (‏scrypt بملح لكل
 *   حساب)، فلا يمكن أن يختلف ما يُكتب عمّا يتحقّق منه الخادم.
 * - كل الحسابات تُتحقَّق أولاً؛ اسم واحد مفقود يُلغي العملية كاملة قبل أي
 *   كتابة، فلا تبقى نصف الحسابات بكلمة قديمة ونصفها بجديدة.
 * - الكتابة داخل معاملة واحدة.
 * - بعد الكتابة يُتحقَّق من كل حساب بـ verifyPassword — إثبات فعليّ أن
 *   الدخول سينجح، لا مجرّد أن الصفّ تحدَّث.
 * - لا تُطبع كلمة مرور ولا تجزئة في السجل.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { closeDb, db, initDb, tx } from "./index.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_FILE = path.join(serverRoot, "passwords.local.json");

/** أدنى طول مقبول — نفس ما يفرضه مسار إنشاء المستخدم. */
const MIN_LENGTH = 8;

interface Assignment {
  username: string;
  password: string;
}

function readAssignments(file: string): Assignment[] {
  if (!fs.existsSync(file)) {
    console.error(`✖ لم يُعثر على الملف: ${file}`);
    console.error("");
    console.error("  أنشئه بهذه الصيغة (اسم الدخول: كلمة المرور):");
    console.error('    { "huthaifa": "كلمة-قوية-هنا", "fouad": "أخرى" }');
    console.error("");
    console.error("  ثم احذفه بعد التنفيذ.");
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`✖ الملف ليس JSON صالحاً: ${(error as Error).message}`);
    process.exit(1);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    console.error("✖ الملف يجب أن يكون كائناً { اسم الدخول: كلمة المرور }");
    process.exit(1);
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) {
    console.error("✖ الملف فارغ.");
    process.exit(1);
  }

  const problems: string[] = [];
  const assignments: Assignment[] = [];

  for (const [username, password] of entries) {
    if (typeof password !== "string") {
      problems.push(`${username}: القيمة ليست نصاً`);
      continue;
    }
    if (password.length < MIN_LENGTH) {
      problems.push(`${username}: أقصر من ${MIN_LENGTH} محارف`);
      continue;
    }
    if (password.trim() !== password) {
      problems.push(`${username}: يبدأ أو ينتهي بمسافة`);
      continue;
    }
    assignments.push({ username: username.trim(), password });
  }

  if (problems.length) {
    console.error("✖ كلمات مرور غير مقبولة:");
    for (const p of problems) console.error(`    ${p}`);
    process.exit(1);
  }

  // كلمة واحدة لحسابين تُفقد ميزة التفرّد التي من أجلها كُتب السكربت
  const seen = new Map<string, string>();
  for (const a of assignments) {
    const owner = seen.get(a.password);
    if (owner) {
      console.error(`✖ نفس كلمة المرور لحسابَي "${owner}" و "${a.username}".`);
      process.exit(1);
    }
    seen.set(a.password, a.username);
  }

  return assignments;
}

/**
 * يرفض العمل إن كان ملف الكلمات متعقَّباً في Git.
 *
 * الفحص لا يُسقط العملية إن تعذّر تشغيل git (بيئة نشر بلا مستودع مثلاً)،
 * لأن الغرض تحذيرٌ من تسريب لا منعُ الاستعمال.
 */
function assertNotTracked(file: string): void {
  try {
    const out = execFileSync("git", ["ls-files", "--error-unmatch", file], {
      cwd: serverRoot,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (out.toString().trim()) {
      console.error(`✖ الملف متعقَّب في Git: ${path.relative(serverRoot, file)}`);
      console.error("  أخرجه أولاً:  git rm --cached " + path.relative(serverRoot, file));
      process.exit(1);
    }
  } catch {
    // غير متعقَّب (أو لا git) — وهو المطلوب
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--check");
  const file = path.resolve(serverRoot, args.find((a) => !a.startsWith("--")) ?? DEFAULT_FILE);

  assertNotTracked(file);
  const assignments = readAssignments(file);

  await initDb();

  // ── التحقّق قبل أي كتابة ──────────────────────────────────────────
  const missing: string[] = [];
  const targets: { id: number; name: string; username: string; role: string; password: string }[] =
    [];

  for (const a of assignments) {
    const user = await db().get<{ id: number; name: string; role: string; is_active: number }>(
      "SELECT id, name, role, is_active FROM users WHERE username = ?",
      [a.username]
    );

    if (!user) {
      missing.push(a.username);
      continue;
    }
    targets.push({ ...user, username: a.username, password: a.password });
  }

  if (missing.length) {
    console.error(`✖ حسابات غير موجودة: ${missing.join("، ")}`);
    console.error("  لم تُغيَّر أي كلمة مرور. راجع الأسماء:  npm run user:role");
    await closeDb();
    process.exit(1);
  }

  console.log(`الحسابات المستهدَفة (${targets.length}):`);
  for (const t of targets) {
    // الحساب المعطّل يُقبل تغييره، لكن يُنبَّه عليه: كلمة جديدة لن تُفيد
    // ما دام is_active = 0، فقد يظنّ المسلِّم أنه سلّم حساباً صالحاً.
    const inactive = (t as { is_active?: number }).is_active ? "" : "   ⚠ معطّل";
    console.log(`  ${t.username.padEnd(14)} ${String(t.role).padEnd(11)} ${t.name}${inactive}`);
  }

  if (dryRun) {
    console.log("\n↷ --check: لم يُكتب شيء.");
    await closeDb();
    return;
  }

  // ── الكتابة ───────────────────────────────────────────────────────
  await tx(async () => {
    for (const t of targets) {
      await db().run("UPDATE users SET password_hash = ? WHERE id = ?", [
        hashPassword(t.password),
        t.id,
      ]);
    }
  });

  // ── إثبات أن الدخول سينجح فعلاً ───────────────────────────────────
  const failed: string[] = [];
  for (const t of targets) {
    const row = await db().get<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = ?",
      [t.id]
    );
    if (!verifyPassword(t.password, row?.password_hash ?? null)) failed.push(t.username);
  }

  if (failed.length) {
    console.error(`\n✖ فشل التحقّق بعد الكتابة: ${failed.join("، ")}`);
    console.error("  لا تسلّم النظام قبل معرفة السبب.");
    await closeDb();
    process.exit(1);
  }

  console.log(`\n✔ حُدِّثت ${targets.length} كلمة مرور، وتحقّقت كلها بنجاح.`);
  console.log(`  احذف ملف الكلمات الآن:  rm ${path.relative(serverRoot, file)}`);

  await closeDb();
}

main().catch(async (error) => {
  console.error("✖ فشل:", error instanceof Error ? error.message : error);
  await closeDb().catch(() => {});
  process.exit(1);
});
