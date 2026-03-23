import "dotenv/config";
import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import prisma from "./lib/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// import multer from "multer";
import cloudinary from "./utils/cloudinary.js";
// import path from "path";
import crypto from "crypto";
// import nodemailer from "nodemailer";
import registerRoute from "./routes/registerRoute.js";
import pointRoute from "./routes/pointRoute.js";
import couponRoute from "./routes/couponRoute.js";
import transactionRoute from "./routes/transactionRoute.js";
import upload from "./middlewares/multer.js";
import transporter from "./utils/transporter.js";
import createEventRouter from "./routes/createEventRoute.js";
import getEventRoute from "./routes/getEventDataRoute.js";
import deleteEventRoute from "./routes/deleteEventRoute.js";
import updateEventRoute from "./routes/updateEventRoute.js";
import voucherRoute from "./routes/voucherRoute.js";
import statusDecisionRoute from "./routes/statusDecisionRoute.js";
import transactionCheckRoute from "./routes/transactionCheckRoute.js";
import uploadPaymentRoute from "./routes/uploadPaymentRoute.js";
import dashboardRoute from "./routes/dashboardRoute.js";
import attendeeListRoute from "./routes/attendeeListRoute.js";
import loginRoute from "./routes/loginRoute.js";
import publicUpEventRoute from "./routes/publicUpEventRoute.js";
import publicUpPerEventRoute from "./routes/publicUpPerEventRoute.js";
import getUserDataRoute from "./routes/getUserDataRoute.js";
import updateUserDataRoute from "./routes/updateUserDataRoute.js";
import updateProfPicRoute from "./routes/updateProfPicRoute.js";
import forgotPassRoute from "./routes/forgotPassRoute.js";
import resetPassRoute from "./routes/resetPassRoute.js";
import logoutRoute from "./routes/logoutRoute.js";

const app: Application = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get("/api/health", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ message: "API is Running!", uptime: process.uptime() });
});

// Register
app.use("/api", registerRoute);

// Points
app.use("/api/users", pointRoute);

// Coupons
app.use("/api/users", couponRoute);

// Transactions
app.use("/api", transactionRoute);

// Create Event (Organizer)
app.use("/api", createEventRouter);

// Get Event Data (Organizer)
app.use("/api", getEventRoute);

// Update Event (Organizer)
app.use("/api", updateEventRoute);

// Delete Event (Organizer)
app.use("/api", deleteEventRoute);

// Accept / Reject Status (Organizer)
app.use("/api", statusDecisionRoute);

// Customer Transaction Check
app.use("/api", transactionCheckRoute);

// Create Voucher (Organizer)
app.use("/api", voucherRoute);

// Upload Payment Proof
app.use("/api", uploadPaymentRoute);

// Dashboard (Organizer)
app.use("/api", dashboardRoute);

// Attendee List (Organizer)
app.use("/api", attendeeListRoute);

// Login
app.use("/api", loginRoute);

// Public Route (Upcoming Event)
app.use("/api", publicUpEventRoute);

// Public Route (Upcoming Event) per Event
app.use("/api", publicUpPerEventRoute);

// Protected Route (Users)
// Get Users Data
app.use("/api", getUserDataRoute);

// Update Users Data
app.use("/api", updateUserDataRoute);

// Update Profile Picture
app.use("/api", updateProfPicRoute);

// Forgot Password
app.use("/api", forgotPassRoute);

// Reset Password
app.use("/api", resetPassRoute);

// Logout
app.use("/api", logoutRoute);

app.listen(PORT, () => {
  console.info(`Server is running on port ${PORT}`);
});
