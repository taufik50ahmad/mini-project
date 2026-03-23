import type { Request, Response } from "express";
import publicUpPerEventService from "../services/publicUpPerEventService.js";

async function publicUpPerEventController(req: Request, res: Response) {
  const eventId = Number(req.params.id);

  if (!eventId || isNaN(eventId)) {
    return res.status(400).json({
      message: "Invalid event ID",
    });
  }

  try {
    const result = await publicUpPerEventService(eventId)

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to fetch event",
      error: error.message,
    });
  }
}

export default publicUpPerEventController;
