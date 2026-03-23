import {Router} from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import updateEventController from "../controllers/updateEventController.js";

const router = Router();

router.patch("/events/:id", verifyToken, updateEventController);

export default router;