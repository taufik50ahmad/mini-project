import type { Request, Response } from "express";
import { pointService } from "../services/pointService.js";

export async function pointController(req: Request, res: Response) {
  try {
    const userEmail = (req as any).user.email;

    const result = await pointService(userEmail);

    return res.status(200).json({
      totalPoints: result.totalPoints,
      details: result.details,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "User not found") {
        return res.status(404).json({
          message: error.message,
        });
      }

      return res.status(500).json({
        message: "Internal server error",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}
