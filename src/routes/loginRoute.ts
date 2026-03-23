import { Router } from "express";
import loginController from "../controllers/loginController.js";

const router: Router = Router();

router.post("/auth/login", loginController);

export default router;