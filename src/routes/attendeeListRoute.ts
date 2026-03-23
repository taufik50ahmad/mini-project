import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import attendeeListController from "../controllers/attendeeListController.js";

const router: Router = Router();

router.get("/events/:id/attendees", verifyToken, attendeeListController);

export default router;