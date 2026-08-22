/**
 * يشغّل الخادم والواجهة معاً في طرفية واحدة.
 *
 * تشغيلهما يدوياً في نافذتين هو مصدر الخطأ الأشيع محلياً: تُنسى نافذة
 * الخادم فيردّ وسيط Vite بـ 500 غامض على /api/auth/login. هنا يقلعان معاً،
 * وسقوط أحدهما يُسقط الآخر فيظهر العطل فوراً بدل أن يُشخَّص كخطأ دخول.
 *
 * لا يحتاج حزمة إضافية (concurrently) — spawn من Node يكفي.
 */
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const tasks = [
  { name: "api", args: ["--prefix", "server", "run", "dev"] },
  { name: "web", args: ["run", "dev"] },
];

const children = tasks.map((task) => {
  const child = spawn(npm, task.args, { stdio: "inherit", shell: process.platform === "win32" });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`\n✖ توقّف ${task.name} (${signal ?? code}) — إيقاف الباقي.`);
    shutdown(code ?? 1);
  });

  return child;
});

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill();
  }

  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}
