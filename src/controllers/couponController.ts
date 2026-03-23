import type { Request, Response } from "express";
import { couponService } from "../services/couponService.js";

export async function couponController(req: Request, res: Response) {
  try {
    const userEmail = (req as any).user.email;

    const result = await couponService(userEmail);

    return res.status(200).json({
      coupons: result.coupons,
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
