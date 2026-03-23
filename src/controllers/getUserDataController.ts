import type { Request, Response } from "express";
import getUserDataService from "../services/getUserDataService.js";

async function getUserDataController(req: Request, res: Response) {
  const userEmail = (req as any).user.email;

  try {
    const result = await getUserDataService(userEmail);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
}

export default getUserDataController;
