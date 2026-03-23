import type { Request, Response } from "express";
import resetPassService from "../services/resetPassService.js";

async function resetPassController(req: Request, res: Response) {
  const { token, newPassword } = req.body;

  try {
    const result = await resetPassService(token, newPassword);

    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "Invalid or expired token") {
      return res.status(400).json({
        message: "Invalid or expired token",
      });
    }

    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
}

export default resetPassController;
