import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  console.warn("WARNING: JWT_SECRET not set. Using insecure development fallback. Do not use in production.");
}

const SECRET = JWT_SECRET ?? "figure8-dev-insecure-do-not-use-in-prod";

export interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, SECRET) as { userId: number; isAdmin: boolean };
    req.userId = payload.userId;
    req.isAdmin = payload.isAdmin;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

export function signToken(userId: number, isAdmin: boolean): string {
  return jwt.sign({ userId, isAdmin }, SECRET, { expiresIn: "7d" });
}
