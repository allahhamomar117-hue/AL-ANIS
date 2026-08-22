/**
 * ينسخ ملفات .sql إلى dist بعد tsc.
 *
 * tsc ينقل ملفات TypeScript وحدها، بينما يقرأ الخادم schema.sql وملفات
 * migrations/ من مجلّده وقت التشغيل — فبلا هذه الخطوة يسقط الإنتاج عند
 * أول إقلاع بخطأ ENOENT على schema.sql.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(serverRoot, "src", "db");
const to = path.join(serverRoot, "dist", "db");

let copied = 0;

function copySql(srcDir, destDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copySql(src, dest);
    } else if (entry.name.endsWith(".sql")) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      copied++;
    }
  }
}

copySql(from, to);
console.log(`✔ نُسخ ${copied} ملف SQL إلى dist/db`);
