import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { ApiError } from "./http.js";

/**
 * تخزين صور الطلاب على قرص الخادم.
 *
 * لا يوجد Supabase Storage في هذا المشروع — القاعدة SQLite محلية والخادم
 * Express، وروابط Supabase في ملف .env غير مستعملة. فالصور تُحفظ في
 * `server/data/uploads/avatars` وتُقدَّم عبر `/api/uploads/...`، وهو مسار
 * يمرّ من وسيط Vite أصلاً فيعمل في التطوير والإنتاج بلا تهيئة إضافية.
 *
 * الملفات تُقدَّم بلا مصادقة (وسم <img> لا يرسل ترويسة Authorization)،
 * ولذلك يحمل كل ملف اسماً عشوائياً 32 خانة سداسية عشرية يتعذّر تخمينه.
 */

/** الأنواع المقبولة مع بصمة أول بايتات كل نوع (لا نثق بما يعلنه العميل). */
const TYPES = [
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
] as const;

/** الحدّ الأقصى لحجم الصورة بعد فكّ الترميز. */
const MAX_BYTES = 2 * 1024 * 1024;

/** المسار العام الذي تُقدَّم منه الصور. */
export const AVATAR_URL_PREFIX = "/api/uploads/avatars";

export const avatarsDir = path.join(config.uploadsDir, "avatars");

function ensureDir(): void {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

/**
 * يحفظ صورة مُرسَلة كـ data URL ويعيد مسارها العام.
 * يرمي 400 إذا كانت الصيغة غير مدعومة أو الحجم أكبر من الحدّ.
 */
export function saveAvatar(dataUrl: string): string {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) throw ApiError.badRequest("صيغة الصورة غير صالحة");

  const [, mime, base64] = match;
  const type = TYPES.find((t) => t.mime === mime);
  if (!type) throw ApiError.badRequest("يُقبل فقط JPEG أو PNG أو WebP");

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw ApiError.badRequest("الصورة فارغة");
  if (buffer.length > MAX_BYTES) throw ApiError.badRequest("حجم الصورة يتجاوز 2 ميغابايت");

  // التحقق من المحتوى نفسه: امتداد معلَن لا يكفي لقبول ملف
  const magicOk = type.magic.every((byte, i) => buffer[i] === byte);
  if (!magicOk) throw ApiError.badRequest("محتوى الملف لا يطابق نوع الصورة");

  ensureDir();
  const name = `${crypto.randomBytes(16).toString("hex")}.${type.ext}`;
  fs.writeFileSync(path.join(avatarsDir, name), buffer);

  return `${AVATAR_URL_PREFIX}/${name}`;
}

/**
 * يحذف ملف صورة سابق. يتجاهل الروابط الخارجية والملفات المفقودة،
 * ويرفض أي مسار يخرج عن مجلد الصور (حماية من ../).
 */
export function deleteAvatar(url: string | null | undefined): void {
  if (!url || !url.startsWith(`${AVATAR_URL_PREFIX}/`)) return;

  const name = path.basename(url);
  const target = path.join(avatarsDir, name);
  if (path.dirname(target) !== avatarsDir) return;

  try {
    fs.unlinkSync(target);
  } catch {
    // الملف غير موجود أصلاً: لا شيء نفعله
  }
}
