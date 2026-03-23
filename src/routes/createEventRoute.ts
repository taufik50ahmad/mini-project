import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import createEventController from "../controllers/createEventController.js";

const router = Router();

router.post("/events", verifyToken, createEventController);

export default router;