import { migrate } from "./index.js";
import { config } from "../config.js";

migrate();
console.log(`✔ تم تهيئة قاعدة البيانات: ${config.dbFile}`);
