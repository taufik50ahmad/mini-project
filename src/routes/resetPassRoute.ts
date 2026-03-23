import { Router } from "express";
import resetPassController from "../controllers/resetPassController.js";

const router = Router();

router.post("/auth/reset-password", resetPassController);

export default router;