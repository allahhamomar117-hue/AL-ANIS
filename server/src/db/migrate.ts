import { closeDb, migrate } from "./index.js";
import { config } from "../config.js";

await migrate();
console.log(
  `✔ تم تهيئة قاعدة البيانات: ${config.databaseUrl ? "PostgreSQL" : config.dbFile}`
);
await closeDb();
