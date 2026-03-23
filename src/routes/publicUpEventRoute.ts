import { Router } from "express";
import publicUpEventController from "../controllers/publicUpEventController.js";

const router: Router = Router();

router.get("/events/upcoming", publicUpEventController);

export default router;