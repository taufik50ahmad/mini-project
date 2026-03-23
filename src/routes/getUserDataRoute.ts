import { Router } from "express";
import getUserDataController from "../controllers/getUserDataController.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.get("/users/profile", verifyToken, getUserDataController);

export default router;