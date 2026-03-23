import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { transactionController } from "../controllers/transactionController.js";

const router = Router();

router.post("/transactions", verifyToken, transactionController);

export default router;
