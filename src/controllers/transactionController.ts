import prisma from "../lib/prisma.js";
import type { Request, Response } from "express";
import { transactionService } from "../services/transactionService.js";

export async function transactionController(req: Request, res: Response) {
  try {
    const authUser = (req as any).user;

    if (authUser.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Only customers can purchase" });
    }

    const { eventId, quantity, couponId, voucherCode, usePoints } = req.body;

    if (!eventId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: "Invalid event or quantity" });
    }

    const result = await transactionService({
      eventId,
      quantity,
      couponId,
      voucherCode,
      usePoints,
      userId: authUser.id,
    });

    return res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof Error) {
      const knownErrors = [
        "Invalid coupon",
        "Invalid voucher",
        "Not enough seats available",
        "Event not found",
      ];

      if (knownErrors.includes(error.message)) {
        return res.status(400).json({ message: error.message });
      }
    }

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}
