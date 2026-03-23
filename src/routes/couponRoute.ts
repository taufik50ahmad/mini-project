import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { couponController } from "../controllers/couponController.js";

const router = Router();

router.get("/coupons", verifyToken, couponController);

export default router;
