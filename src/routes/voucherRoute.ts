import { Router } from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import voucherController from "../controllers/voucherController.js";

const router = Router();

router.post("/vouchers", verifyToken, voucherController);

export default router;