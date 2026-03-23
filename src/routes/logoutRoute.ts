import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import logoutController from "../controllers/logoutController.js";

const router = Router();

router.post("/auth/logout", verifyToken, logoutController);

export default router;