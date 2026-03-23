import { Router } from "express";
import forgotPassController from "../controllers/forgotPassController.js";

const router: Router = Router();

router.post("/auth/forgot-password", forgotPassController);

export default router;