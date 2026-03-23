import type { Request, Response } from "express";
import transactionCheckService from "../services/transactionCheckService.js";

async function transactionCheckController(req: Request, res: Response) {
  if ((req as any).user.role !== "CUSTOMER") {
    return res.status(403).json({
      message: "Only customers can access this",
    });
  }

  const email = (req as any).user.email;

  try {
    const result = await transactionCheckService(email);

    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "User not found") {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
}

export default transactionCheckController;
