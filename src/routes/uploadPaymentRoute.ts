import { Router } from "express";
import upload from "../middlewares/multer.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import uploadPaymentController from "../controllers/uploadPaymentController.js";

const router = Router();

router.patch(
  "/transactions/:id/payment-proof",
  verifyToken,
  upload.single("paymentProof"),
  uploadPaymentController,
);

export default router;
