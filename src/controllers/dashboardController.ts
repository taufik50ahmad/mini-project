import type { Request, Response } from "express";
import dashboardService from "../services/dashboardService.js";

async function dashboardController(req: Request, res: Response) {
  try {
    if ((req as any).user.role !== "ORGANIZER") {
      return res.status(403).json({ message: "Only organizers allowed" });
    }

    const organizerId = (req as any).user.id;

    const result = await dashboardService(organizerId);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Dashboard error" });
  }
}

export default dashboardController;
