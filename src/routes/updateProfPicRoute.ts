import { Router } from "express";
import upload from "../middlewares/multer.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import updateProfPicController from "../controllers/updateProfPicController.js";

const router: Router = Router();

router.patch(
  "/users/profile-picture",
  verifyToken,
  upload.single("profilePicture"),
  updateProfPicController,
);

export default router;