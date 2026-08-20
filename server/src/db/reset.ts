import fs from "node:fs";
import { config } from "../config.js";

for (const suffix of ["", "-wal", "-shm"]) {
  const file = config.dbFile + suffix;
  if (fs.existsSync(file)) fs.rmSync(file);
}

console.log(`✔ تم حذف قاعدة البيانات: ${config.dbFile}`);
console.log("  شغّل npm run db:seed لإعادة البيانات التجريبية.");
