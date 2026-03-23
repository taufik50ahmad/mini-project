import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { pointController } from "../controllers/pointController.js";

const router = Router();

router.get("/points", verifyToken, pointController);

export default router;
