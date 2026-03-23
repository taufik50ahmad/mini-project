import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import deleteEventController from "../controllers/deleteEventController.js";

const router = Router();

router.delete("/events/:id", verifyToken, deleteEventController);

export default router;
