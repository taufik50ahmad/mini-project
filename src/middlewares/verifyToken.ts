import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Token is required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    // simpan hasil decode ke request
    (req as any).user = decoded;

    // lanjut ke route berikutnya
    next();
  } catch (error: any) {
    return res.status(401).json({
      message: "Invalid token",
      error: error.message,
    });
  }
}