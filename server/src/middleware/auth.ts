import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { ApiError } from "../lib/http.js";

export const ROLES = ["ADMIN", "SUPERVISOR", "TEACHER"] as const;
export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: number;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: number }): string {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

/** يتطلب رمز Bearer صالحاً ويحمّل المستخدم في req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized("رمز الدخول مفقود"));

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  } catch {
    return next(ApiError.unauthorized("رمز الدخول غير صالح أو منتهي"));
  }

  const user = db
    .prepare("SELECT id, name, role FROM users WHERE id = ? AND is_active = 1")
    .get(Number(payload.sub)) as AuthUser | undefined;

  if (!user) return next(ApiError.unauthorized("المستخدم غير موجود"));

  // دور غير معروف (بيانات قديمة أو معدّلة يدوياً) يُعامل كأقلّ صلاحية
  // بدل أن ينهار أول فحص صلاحيات يعتمد عليه
  if (!ROLES.includes(user.role)) {
    console.warn(`[auth] دور غير معروف "${user.role}" للمستخدم ${user.id} — يُعامل كمدرّس`);
    user.role = "TEACHER";
  }

  req.user = user;
  next();
}

/** يقصر الوصول على أدوار معيّنة. يُستخدم بعد requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("هذه العملية تتطلب صلاحية أعلى"));
    }
    next();
  };
}

/**
 * إدارة حسابات الكادر محصورة بالمدير (ADMIN) وحده.
 * المشرف يرى كل البيانات لكنه لا ينشئ حسابات ولا يغيّر الأدوار،
 * منعاً للتضارب في الصلاحيات.
 */
export const requireUserManager = requireRole("ADMIN");

/** كل صلاحيات البيانات الموسّعة: المدير والمشرف سواء. */
export const requireStaff = requireRole("ADMIN", "SUPERVISOR");
