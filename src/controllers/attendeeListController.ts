import type { Request, Response } from "express";
import attendeeListService from "../services/attendeeListService.js";

async function attendeeListController(req: Request, res: Response) {
  if ((req as any).user.role !== "ORGANIZER") {
    return res.status(403).json({
      message: "Only organizers can view attendees",
    });
  }

  const organizerId = Number((req as any).user.id);
  const eventId = Number(req.params.id);

  try {
    const result = await attendeeListService(organizerId, eventId);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      message: error.message,
    });
  }
}

export default attendeeListController;
