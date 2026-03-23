import {Router} from "express";
import updateUserDataController from "../controllers/updateUserDataController.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.put("/users/profile", verifyToken, updateUserDataController);

export default router;