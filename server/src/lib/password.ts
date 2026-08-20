import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * تجزئة كلمات المرور بـ scrypt المدمج في Node — بلا تبعيات خارجية.
 * الصيغة المخزّنة: scrypt$<الملح بست عشري>$<التجزئة بست عشري>
 */
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;

  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);

  // مقارنة ثابتة الزمن لمنع تسريب المعلومات عبر التوقيت
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
