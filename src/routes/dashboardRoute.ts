import { Router } from "express";
import dashboardController from "../controllers/dashboardController.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router: Router = Router();

router.get("/organizer/dashboard", verifyToken, dashboardController);

export default router;