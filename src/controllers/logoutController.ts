import type { Request, Response } from "express";

async function logoutController(req: Request, res: Response) {
  try {
    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Logout failed",
      error: error.message,
    });
  }
}

export default logoutController;