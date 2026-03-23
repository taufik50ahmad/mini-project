import { Router } from "express";
import { registerController } from "../controllers/registerController.js";

const router = Router();

router.post("/register", registerController);

export default router;