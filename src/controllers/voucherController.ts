import type { Request, Response } from "express";
import voucherService from "../services/voucherService.js";

async function voucherController(req: Request, res: Response) {
  try {
    // 1️⃣ Check role
    if ((req as any).user.role !== "ORGANIZER") {
      return res.status(403).json({
        message: "Only organizers can create vouchers",
      });
    }

    const { code, discountAmount, eventId, expiresAt } = req.body;

    const result = await voucherService(
      code,
      discountAmount,
      eventId,
      expiresAt,
      (req as any).user.email,
    );

    return res.status(201).json(result);
  } catch (error: any) {
    if (
      error.message ===
        "code, discountAmount, eventId, and expiresAt are required" ||
      error.message === "Organizer not found" ||
      error.message === "You can only create voucher for your own event" ||
      error.message === "Voucher code already exists"
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
}

export default voucherController;
