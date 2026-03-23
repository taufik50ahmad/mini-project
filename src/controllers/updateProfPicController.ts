import type { Request, Response } from "express";
import updateProfPicService from "../services/updateProfPicService.js";

async function updateProfPicController(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;

    const result = await updateProfPicService(
      req.file as Express.Multer.File,
      userId,
    );

    return res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "No image uploaded") {
      return res.status(400).json({
        message: error.message,
      });
    }
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({
        message: error.message,
      });
    }
    return res.status(500).json({
      message: error.message,
    });
  }
}

export default updateProfPicController;
