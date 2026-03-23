import type { Request, Response } from "express";
import updateEventService from "../services/updateEventService.js";

async function updateEventController(req: Request, res: Response) {
  try {
    const eventId = Number(req.params.id);
    const user = (req as any).user;

    const { title, description, location, price, totalSeats, eventDate } =
      req.body;

    const updatedData = {
      title,
      description,
      location,
      price,
      totalSeats,
      eventDate: eventDate ? new Date(eventDate) : undefined,
    };

    const result = await updateEventService(eventId, user.email, updatedData);

    return res.json(result);
  } catch (error: any) {
    if (error.message === "Event not found or not yours") {
      return res.status(404).json({ message: error.message });
    }

    return res.status(500).json({ message: "Failed to update event" });
  }
}

export default updateEventController;
