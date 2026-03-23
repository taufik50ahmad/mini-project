import type { Request, Response } from "express";
import publicUpEventService from "../services/publicUpEventService.js";

async function publicUpEventController(req: Request, res: Response) {
  try {
    const result = await publicUpEventService();

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to fetch events",
      error: error.message,
    });
  }
}

export default publicUpEventController;
