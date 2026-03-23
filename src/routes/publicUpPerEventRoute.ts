import { Router } from "express";
import publicUpPerEventController from "../controllers/publicUpPerEventController.js";

const router: Router = Router();

router.get("/events/:id", publicUpPerEventController);

export default router;