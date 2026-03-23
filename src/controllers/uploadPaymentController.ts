import type { Request, Response } from "express";
import uploadPaymentService from "../services/uploadPaymentService.js";

async function uploadPaymentController(req: Request, res: Response) {
  if ((req as any).user.role !== "CUSTOMER") {
    return res.status(403).json({
      message: "Only customer can upload payment proof",
    });
  }

  const transactionId = Number(req.params.id);
  const userId = (req as any).user.id;

  try {
    const result = await uploadPaymentService(
      transactionId,
      req.file as Express.Multer.File,
      userId,
    );

    return res.status(200).json({
      message: "Payment proof uploaded successfully",
      data: result,
    });
  } catch (error: any) {
    if (error.message === "Transaction not found") {
      return res.status(404).json({ message: error.message });
    }

    if (
      error.message === "You can only upload proof for your own transaction"
    ) {
      return res.status(403).json({ message: error.message });
    }

    if (
      error.message === "Cannot upload proof for finalized transaction" ||
      error.message === "No file uploaded"
    ) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
}

export default uploadPaymentController;
