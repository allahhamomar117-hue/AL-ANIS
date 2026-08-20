import { z } from "zod";

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ يجب أن يكون بصيغة YYYY-MM-DD");

export const idParam = z.coerce.number().int().positive();

export const attendanceStatus = z.enum(["present", "absent", "late", "excused"]);
export const recitationType = z.enum(["full", "half", "more", "surah"]);
export const rating = z.enum(["excellent", "good", "needs"]);

export type RecitationType = z.infer<typeof recitationType>;
export type Rating = z.infer<typeof rating>;
export const userRole = z.enum(["ADMIN", "SUPERVISOR", "TEACHER"]);

export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * تاريخ اليوم بالتوقيت المحلي بصيغة YYYY-MM-DD.
 *
 * toISOString() يحوّل إلى UTC، فبعد منتصف الليل بتوقيت محلي متقدّم على
 * غرينتش (مثل +03) يكون تاريخ UTC ما زال أمس، فتُسجَّل تلاوة الساعة الواحدة
 * صباحاً على اليوم السابق. نبني التاريخ من مكوّناته المحلية مباشرة.
 *
 * تُستدعى عند كل طلب لا مرة واحدة عند الإقلاع؛ راجع التعليق عند كل استعمال.
 */
export function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
