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

/**
 * أقسام المعهد. مفاتيح ثابتة تُترجَم في الواجهة، على غرار halaqaStage.
 *
 * لا تخلطها بـ halaqat.stage: تلك مرحلة دراسية وصفية
 * (primary|middle_high|intensive)، وهذه تقسيم إداري يحدّد من يرى ماذا —
 * والمكثفة لا مقابل لها في المراحل أصلاً.
 */
export const department = z.enum(["PRIMARY", "MIDDLE_HIGH", "INTENSIVE"]);
export type Department = z.infer<typeof department>;

/**
 * القسم كما يصل من نموذج الواجهة: القيمة، أو null/"" لـ «كل الأقسام».
 * السلسلة الفارغة تأتي من <select> بلا اختيار، فتُطبَّع إلى null هنا بدل
 * أن تصل إلى القاعدة فتسقط على قيد CHECK.
 */
export const departmentInput = z
  .union([department, z.literal(""), z.null()])
  .transform((value) => (value === "" ? null : value));

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
