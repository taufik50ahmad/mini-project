import type { Request, Response } from "express";
import forgotPassService from "../services/forgotPassService.js";

async function forgotPassController(req: Request, res: Response) {
  const { email } = req.body;

  try {
    const result = await forgotPassService(email);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
}

export default forgotPassController;
