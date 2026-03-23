import type { Request, Response } from "express";
import type { TransactionStatus } from "../generated/prisma/client.js";
import statusDecisionService from "../services/statusDecisionService.js";

async function statusDecisionController(req: Request, res: Response) {
  if ((req as any).user.role !== "ORGANIZER") {
    return res.status(403).json({
      message: "Only organizer can update transaction status",
    });
  }

  const transactionId = Number(req.params.id);
  const { status } = req.body;
  const userId = (req as any).user.id;

  if (!transactionId || isNaN(transactionId)) {
    return res.status(400).json({
      message: "Invalid transaction ID",
    });
  }

  if (!["ACCEPTED", "REJECTED"].includes(status)) {
    return res.status(400).json({
      message: "Status must be ACCEPTED or REJECTED",
    });
  }

  try {
    const result = await statusDecisionService(
      transactionId,
      status as TransactionStatus,
      userId,
    );

    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "Transaction not found") {
      return res.status(404).json({ message: error.message });
    }

    if (error.message === "You are not the organizer of this event") {
      return res.status(403).json({ message: error.message });
    }

    if (error.message === "Transaction already finalized") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(400).json({
      message: error.message,
    });
  }
}

export default statusDecisionController;
