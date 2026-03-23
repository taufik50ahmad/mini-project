import type { Request, Response } from "express";
import createEventService from "../services/createEventService.js";

async function createEventController(req: Request, res: Response) {
  if ((req as any).user.role !== "ORGANIZER") {
    return res
      .status(403)
      .json({ message: "Only organizers can create events" });
  }

  const { title, description, location, price, totalSeats, eventDate } =
    req.body;

  if (!(req as any).user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if ((req as any).user.role !== "ORGANIZER") {
    return res
      .status(403)
      .json({ message: "Only organizers can create events" });
  }

//   if (
//     !title ||
//     !description ||
//     !location ||
//     !price ||
//     !totalSeats ||
//     !eventDate
//   ) {
//     return res.status(400).json({ message: "Missing required fields" });
//   }

  // Required Field Handler in Postman
  const requiredFields = {
    title,
    description,
    location,
    price,
    totalSeats,
    eventDate,
  };

  const missingFields = Object.entries(requiredFields)
    .filter(
      ([_, value]) => value === undefined || value === null || value === "",
    )
    .map(([key]) => key);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  if (typeof price !== "number" || price < 0) {
    return res.status(400).json({ message: "Invalid price" });
  }

  if (totalSeats <= 0) {
    return res
      .status(400)
      .json({ message: "Total seats must be greater than 0" });
  }

  if (new Date(eventDate) < new Date()) {
    return res
      .status(400)
      .json({ message: "Event date must be in the future" });
  }

  try {
    const result = await createEventService(
      title,
      description,
      location,
      price,
      totalSeats,
      eventDate,
      (req as any).user.email,
    );

    return res
      .status(201)
      .json({ message: "Event created successfully", result });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export default createEventController;
