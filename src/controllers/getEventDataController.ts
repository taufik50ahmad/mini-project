import type { Request, Response } from "express";
import getEventDataService from "../services/getEventDataService.js";

async function getEventDataController(req: Request, res: Response) {
    try {
      if ((req as any).user.role !== "ORGANIZER") {
        return res.status(403).json({ message: "Only organizers allowed" });
      }

      const result = await getEventDataService((req as any).user.email)

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  }

export default getEventDataController;
