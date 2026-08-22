import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z, ZodError, type ZodTypeAny } from "zod";
import { config } from "../config.js";

/** خطأ يحمل رمز حالة HTTP. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "غير مصرّح") {
    return new ApiError(401, message);
  }
  static forbidden(message = "ممنوع") {
    return new ApiError(403, message);
  }
  static notFound(message = "غير موجود") {
    return new ApiError(404, message);
  }
  static conflict(message: string) {
    return new ApiError(409, message);
  }
}

/** يمرر أخطاء الدوال غير المتزامنة إلى معالج الأخطاء. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * تحقّق من البيانات وإرجاعها بنوع الإخراج.
 *
 * النوع مأخوذ من z.output لا من الاستنتاج العام، وإلا ظهرت الحقول ذات
 * ‏`.default()` كأنها قد تكون undefined رغم أن zod يملؤها دائماً.
 */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.badRequest("بيانات غير صالحة", flattenZod(result.error));
  }
  return result.data as z.output<S>;
}

function flattenZod(error: ZodError) {
  return error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}

/** معالج الأخطاء العام — يُسجَّل آخر شيء في التطبيق. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const where = `${req.method} ${req.originalUrl}`;

  if (err instanceof ApiError) {
    // أخطاء الخادم تُسجَّل دائماً؛ أخطاء المستخدم (4xx) لا تملأ السجل
    if (err.status >= 500) {
      console.error(`[${where}] ${err.status} ${err.message}`, err.details ?? "");
    }
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);

  // قيود القاعدة تُترجم إلى أخطاء مفهومة. SQLite يعبّر عنها بنصّ الرسالة،
  // و Postgres برمز SQLSTATE — نلتقط الاثنين حتى يبقى الردّ واحداً.
  const sqlState = (err as { code?: string }).code;

  if (message.includes("UNIQUE constraint failed") || sqlState === "23505") {
    res.status(409).json({ error: "السجل موجود مسبقاً", details: message });
    return;
  }
  if (message.includes("FOREIGN KEY constraint failed") || sqlState === "23503") {
    res.status(400).json({ error: "مرجع غير صالح", details: message });
    return;
  }
  // انتهاك CHECK (قيمة خارج القيم المسموحة) — 23514 في Postgres
  if (message.includes("CHECK constraint failed") || sqlState === "23514") {
    res.status(400).json({ error: "قيمة غير مسموحة", details: message });
    return;
  }

  // خطأ غير متوقع: نطبع كل ما يلزم لتشخيصه من الطرفية
  console.error(`[${where}] 500 خطأ غير متوقع:`, message);
  if (err instanceof Error && err.stack) console.error(err.stack);

  res.status(500).json({
    error: "خطأ داخلي في الخادم",
    // التفاصيل في التطوير فقط حتى لا تتسرّب في الإنتاج
    ...(config.isProd ? {} : { details: message }),
  });
}
