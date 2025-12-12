import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  user?: { id?: string };
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.split(" ")[1];

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET is not defined");
      return res.status(500).json({ message: "Server configuration error" });
    }

    // Accept payloads that use either { id } or { userId }
    const decoded = jwt.verify(token, secret) as { id?: string; userId?: string };

    const userId = decoded.id ?? decoded.userId;
    if (!userId) {
      console.error("Auth error: token missing user id");
      return res.status(401).json({ message: "Invalid token payload" });
    }

    // Keep older code that used req.userId
    req.userId = userId;

    // ALSO set req.user = { id } so controllers expecting req.user.id continue to work
    req.user = { id: userId };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
