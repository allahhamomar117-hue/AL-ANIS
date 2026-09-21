import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { ApiError } from "./http.js";

/**
 * تخزين صور الطلاب.
 *
 * مخزنان، والاختيار بينهما بوجود إعدادات Cloudinary لا بعَلَم منفصل:
 *
 *  • Cloudinary — المخزن المقصود في الاستضافة. قرص Netlify Function مؤقّت
 *    وللقراءة فقط عدا /tmp، فالصورة المحفوظة عليه تختفي مع أول استدعاء
 *    بارد. Cloudinary يخرجها من دورة حياة الخادم كلياً.
 *
 *  • قرص الخادم — الاحتياط حين تغيب الإعدادات: يُبقي التطوير المحلي
 *    ونسخة Railway تعملان بلا حساب ولا شبكة.
 *
 * الروابط القديمة على شكل /api/uploads/avatars/… تبقى صالحة: الحذف يميّز
 * الشكلين، والواجهة تمرّر الرابط المطلق كما هو (انظر assetUrl).
 *
 * لا SDK: طلبان HTTP بسيطان موقَّعان بـ sha1، فلا اعتمادية أصلية جديدة
 * تدخل حزمة الدالة ولا شيء يُحزَّم زائداً.
 */

/** الأنواع المقبولة مع بصمة أول بايتات كل نوع (لا نثق بما يعلنه العميل). */
const TYPES = [
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
] as const;

/** الحدّ الأقصى لحجم الصورة بعد فكّ الترميز. */
const MAX_BYTES = 2 * 1024 * 1024;

/** المسار العام الذي تُقدَّم منه الصور المحفوظة على القرص. */
export const AVATAR_URL_PREFIX = "/api/uploads/avatars";

export const avatarsDir = path.join(config.uploadsDir, "avatars");

/** هل إعدادات Cloudinary كاملة؟ الثلاثة معاً أو لا شيء. */
function cloudinaryEnabled(): boolean {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  return Boolean(cloudName && apiKey && apiSecret);
}

/** يفحص data URL ويعيد البايتات ونوعها، أو يرمي 400 برسالة عربية. */
function decodeImage(dataUrl: string): { buffer: Buffer; mime: string; ext: string } {
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

  return { buffer, mime, ext: type.ext };
}

/**
 * توقيع Cloudinary: sha1 لمعاملات الطلب مرتّبة أبجدياً ومتبوعةً بالسرّ.
 * api_key و file و resource_type تُستثنى من التوقيع بنصّ التوثيق.
 */
function sign(params: Record<string, string>): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(payload + config.cloudinary.apiSecret).digest("hex");
}

async function callCloudinary(action: "upload" | "destroy", fields: Record<string, string>) {
  const url = `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/${action}`;
  const body = new URLSearchParams({ ...fields, api_key: config.cloudinary.apiKey });

  const response = await fetch(url, { method: "POST", body });
  const json = (await response.json().catch(() => null)) as
    | { secure_url?: string; result?: string; error?: { message?: string } }
    | null;

  if (!response.ok) {
    // رسالة Cloudinary نفسها أنفع من الحالة الرقمية: تقول «Invalid Signature»
    // أو «File size too large» بدل 400 مجرّد.
    throw new Error(json?.error?.message ?? `HTTP ${response.status}`);
  }

  return json;
}

/**
 * يستخرج public_id من رابط Cloudinary.
 * الشكل: https://res.cloudinary.com/<cloud>/image/upload/v<رقم>/<public_id>.<ext>
 * يعيد null لأي رابط آخر (صورة قرص قديمة أو رابط خارجي).
 */
function publicIdOf(url: string): string | null {
  const match = /\/image\/upload\/(?:[^/]+\/)*?v\d+\/(.+)\.[a-z0-9]+$/i.exec(url);
  return match ? match[1] : null;
}

/**
 * يحفظ صورة مُرسَلة كـ data URL ويعيد رابطها العام.
 * يرمي 400 إذا كانت الصيغة غير مدعومة أو الحجم أكبر من الحدّ.
 */
export async function saveAvatar(dataUrl: string): Promise<string> {
  const { buffer, mime, ext } = decodeImage(dataUrl);

  // اسم عشوائي 32 خانة سداسية عشرية: الصور تُقدَّم بلا مصادقة (وسم <img>
  // لا يرسل ترويسة Authorization) فالحماية بتعذّر التخمين.
  const name = crypto.randomBytes(16).toString("hex");

  if (cloudinaryEnabled()) return uploadToCloudinary(buffer, mime, name);

  fs.mkdirSync(avatarsDir, { recursive: true });
  fs.writeFileSync(path.join(avatarsDir, `${name}.${ext}`), buffer);

  return `${AVATAR_URL_PREFIX}/${name}.${ext}`;
}

async function uploadToCloudinary(buffer: Buffer, mime: string, name: string): Promise<string> {
  const folder = config.cloudinary.folder;
  const timestamp = String(Math.floor(Date.now() / 1000));

  let json;
  try {
    json = await callCloudinary("upload", {
      file: `data:${mime};base64,${buffer.toString("base64")}`,
      folder,
      public_id: name,
      timestamp,
      signature: sign({ folder, public_id: name, timestamp }),
    });
  } catch (error) {
    /*
     * فشل الرفع خطأ خادم لا خطأ مستخدم: الصورة سليمة (مرّت decodeImage)
     * والعطل في الاعتماد أو الشبكة. 502 يقول ذلك، والسبب يُسجَّل للمشغّل
     * ولا يُسرَّب للعميل لأنه قد يحمل تفاصيل الحساب.
     */
    console.error("✖ فشل رفع الصورة إلى Cloudinary:", error);
    throw ApiError.badGateway("تعذّر رفع الصورة إلى خدمة التخزين، حاول مجدداً");
  }

  if (!json?.secure_url) {
    console.error("✖ استجابة Cloudinary بلا secure_url:", json);
    throw ApiError.badGateway("تعذّر رفع الصورة إلى خدمة التخزين، حاول مجدداً");
  }

  return json.secure_url;
}

/**
 * يحذف صورة سابقة — من Cloudinary أو من القرص بحسب شكل الرابط.
 *
 * لا يرمي أبداً: يُستدعى بعد نجاح تحديث القاعدة، وفشل تنظيف ملف قديم
 * يجب ألّا يقلب عمليةً نجحت إلى خطأ يراه المستخدم.
 */
export async function deleteAvatar(url: string | null | undefined): Promise<void> {
  if (!url) return;

  if (url.startsWith(`${AVATAR_URL_PREFIX}/`)) {
    const name = path.basename(url);
    const target = path.join(avatarsDir, name);
    // حماية من ../: أي مسار يخرج عن مجلّد الصور يُترك
    if (path.dirname(target) !== avatarsDir) return;

    try {
      fs.unlinkSync(target);
    } catch {
      // الملف غير موجود أصلاً: لا شيء نفعله
    }
    return;
  }

  const publicId = publicIdOf(url);
  if (!publicId || !cloudinaryEnabled()) return;

  const timestamp = String(Math.floor(Date.now() / 1000));

  try {
    await callCloudinary("destroy", {
      public_id: publicId,
      timestamp,
      signature: sign({ public_id: publicId, timestamp }),
    });
  } catch (error) {
    console.error(`⚠ تعذّر حذف الصورة ${publicId} من Cloudinary:`, error);
  }
}
