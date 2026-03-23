import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import transactionCheckController from "../controllers/transactionCheckController.js";

const router = Router();

router.get("/transactions/my", verifyToken, transactionCheckController);

export default router;