import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import statusDecisionController from "../controllers/statusDecisionController.js";

const router = Router();

router.patch("/transactions/:id/status", verifyToken, statusDecisionController);

export default router;