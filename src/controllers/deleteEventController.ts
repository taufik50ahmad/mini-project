import type { Request, Response } from "express";
import deleteEventService from "../services/deleteEventService.js";

async function deleteEventController(req: Request, res: Response) {
  try {
    const eventId = Number(req.params.id);

    const result = await deleteEventService(eventId, (req as any).user.email);

    res.json(result);
  } catch (error: any) {
    if (error.message === "Event not found or not yours") {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: "Failed to delete event" });
  }
}

export default deleteEventController;
