import type { Request, Response } from "express";
import updateUserDataService from "../services/updateUserDataService.js";

async function updateUserDataController(req: Request, res: Response) {
  const userEmail = (req as any).user.email;
  const { name, email, oldPassword, newPassword } = req.body;

  try {
    const result = await updateUserDataService(userEmail, name, email, oldPassword, newPassword);

    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "User not found") {
      return res.status(404).json({
        message: "User not found",
      });
    }
    if (error.message === "Old password is incorrect") {
      return res.status(401).json({
        message: "Old password is incorrect",
      });
    }
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
}

export default updateUserDataController;
