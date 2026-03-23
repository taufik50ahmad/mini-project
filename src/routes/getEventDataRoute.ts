import { Router } from "express";
import getEventDataController from "../controllers/getEventDataController.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/organizer/events", verifyToken, getEventDataController);

export default router;