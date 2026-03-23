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

// Transaction:id/status
// app.patch(
//   "/api/transactions/:id/status",
//   verifyToken,
//   async (req: Request, res: Response) => {
//     if ((req as any).user.role !== "ORGANIZER") {
//       return res
//         .status(403)
//         .json({ message: "Only organizer can update status" });
//     }

//     const transactionId = Number(req.params.id);
//     const { status } = req.body;

//     if (!["ACCEPTED", "REJECTED"].includes(status)) {
//       return res.status(400).json({ message: "Invalid status" });
//     }

//     try {
//       const result = await prisma.$transaction(async (tx) => {
//         const transaction = await tx.transaction.findUnique({
//           where: { id: transactionId },
//           include: { event: true },
//         });

//         if (!transaction) throw new Error("Transaction not found");

//         if (transaction.status !== "PENDING") {
//           throw new Error("Transaction already finalized");
//         }

//         // 🔴 If REJECTED → restore seats + coupon
//         if (status === "REJECTED") {
//           await tx.event.update({
//             where: { id: transaction.eventId },
//             data: {
//               availableSeats: {
//                 increment: transaction.quantity,
//               },
//             },
//           });

//           // restore coupon
//           if (transaction.usedCouponId) {
//             await tx.coupon.update({
//               where: { id: transaction.usedCouponId },
//               data: { isUsed: false },
//             });
//           }
//         }

//         // update status
//         return await tx.transaction.update({
//           where: { id: transactionId },
//           data: { status },
//         });
//       });

//       return res.status(200).json(result);
//     } catch (error: any) {
//       return res.status(400).json({ message: error.message });
//     }
//   },
// );

// Create Event (Organizer)
app.use("/api", createEventRouter);

// Get Event Data (Organizer)
app.use("/api", getEventRoute);

// Update Event (Organizer)
app.patch(
  "/api/events/:id",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const eventId = Number(req.params.id);

      const event = await prisma.event.findFirst({
        where: {
          id: eventId,
          organizer: {
            email: (req as any).user.email,
          },
        },
      });

      if (!event) {
        return res
          .status(404)
          .json({ message: "Event not found or not yours" });
      }

      const updatedEvent = await prisma.event.update({
        where: { id: eventId },
        data: req.body,
      });

      res.json(updatedEvent);
    } catch (error) {
      res.status(500).json({ message: "Failed to update event" });
    }
  },
);

// Delete Event (Organizer)
app.use("/api", deleteEventRoute);

// Accept / Reject Status (Organizer)
app.patch(
  "/api/transactions/:id/status",
  verifyToken,
  async (req: Request, res: Response) => {
    if ((req as any).user.role !== "ORGANIZER") {
      return res.status(403).json({
        message: "Only organizer can update transaction status",
      });
    }

    const transactionId = Number(req.params.id);
    const { status } = req.body;

    if (!transactionId || isNaN(transactionId)) {
      return res.status(400).json({
        message: "Invalid transaction ID",
      });
    }

    if (!["ACCEPTED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        message: "Status must be ACCEPTED or REJECTED",
      });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.findUnique({
          where: { id: transactionId },
          include: {
            event: true,
          },
        });

        if (!transaction) {
          throw new Error("Transaction not found");
        }

        // Only PENDING transactions can be updated
        if (transaction.status !== "PENDING") {
          throw new Error("Transaction already finalized");
        }

        // Make sure this organizer owns the event
        if (transaction.event.organizerId !== (req as any).user.id) {
          throw new Error("You are not the organizer of this event");
        }

        // ============================
        // 🔴 HANDLE REJECTED CASE
        // ============================
        if (status === "REJECTED") {
          // 1️⃣ Restore seats
          await tx.event.update({
            where: { id: transaction.eventId },
            data: {
              availableSeats: {
                increment: transaction.quantity,
              },
            },
          });

          // 2️⃣ Restore coupon (if used)
          if (transaction.usedCouponId) {
            await tx.coupon.update({
              where: { id: transaction.usedCouponId },
              data: { isUsed: false },
            });
          }

          // 3️⃣ Restore points (ONLY ONCE)
          if (
            transaction.usedPoints &&
            transaction.usedPoints > 0 &&
            !transaction.pointsRestored
          ) {
            const expiry = new Date();
            expiry.setMonth(expiry.getMonth() + 3);

            await tx.point.create({
              data: {
                userId: transaction.userId,
                amount: transaction.usedPoints,
                expiresAt: expiry,
              },
            });
          }
        }

        // ============================
        // ✅ FINAL UPDATE
        // ============================
        const updatedTransaction = await tx.transaction.update({
          where: { id: transactionId },
          data: {
            status,
            ...(status === "REJECTED" &&
              transaction.usedPoints &&
              transaction.usedPoints > 0 &&
              !transaction.pointsRestored && {
                pointsRestored: true,
              }),
          },
        });

        return updatedTransaction;
      });

      // ============================
      // 📧 SEND EMAIL NOTIFICATION
      // ============================

      const transactionInfo = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          user: true,
          event: true,
        },
      });

      if (transactionInfo) {
        if (status === "ACCEPTED") {
          await transporter.sendMail({
            to: transactionInfo.user.email,
            subject: "Payment Accepted 🎉",
            html: `
              <h2>Payment Accepted</h2>
              <p>Your payment for event <b>${transactionInfo.event.title}</b> has been accepted.</p>
              <p>Tickets: ${transactionInfo.quantity}</p>
              <p>Total Paid: ${transactionInfo.totalPrice}</p>
              <p>We look forward to seeing you at the event!</p>
            `,
          });
        }

        if (status === "REJECTED") {
          await transporter.sendMail({
            to: transactionInfo.user.email,
            subject: "Payment Rejected",
            html: `
              <h2>Payment Rejected</h2>
              <p>Your payment for event <b>${transactionInfo.event.title}</b> was rejected.</p>
              <p>Please upload a valid payment proof.</p>
            `,
          });
        }
      }

      return res.status(200).json({
        message: `Transaction ${status}`,
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        message: error.message,
      });
    }
  },
);

// Customer Transaction Check
app.get(
  "/api/transactions/my",
  verifyToken,
  async (req: Request, res: Response) => {
    if ((req as any).user.role !== "CUSTOMER") {
      return res.status(403).json({
        message: "Only customers can access this",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: (req as any).user.email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
      },
      include: {
        event: true, // so customer can see event info
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(transactions);
  },
);

// Create Voucher (Organizer)
app.post("/api/vouchers", verifyToken, async (req: Request, res: Response) => {
  try {
    // 1️⃣ Check role
    if ((req as any).user.role !== "ORGANIZER") {
      return res.status(403).json({
        message: "Only organizers can create vouchers",
      });
    }

    const { code, discountAmount, eventId, expiresAt } = req.body;

    // 2️⃣ Basic validation
    if (!code || !discountAmount || !eventId || !expiresAt) {
      return res.status(400).json({
        message: "code, discountAmount, eventId, and expiresAt are required",
      });
    }

    // 3️⃣ Get logged-in organizer
    const organizer = await prisma.user.findUnique({
      where: { email: (req as any).user.email },
    });

    if (!organizer) {
      return res.status(404).json({ message: "Organizer not found" });
    }

    // 4️⃣ Make sure event belongs to this organizer
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizerId: organizer.id,
      },
    });

    if (!event) {
      return res.status(403).json({
        message: "You can only create voucher for your own event",
      });
    }

    // 5️⃣ Check duplicate voucher code
    const existingVoucher = await prisma.voucher.findUnique({
      where: { code },
    });

    if (existingVoucher) {
      return res.status(400).json({
        message: "Voucher code already exists",
      });
    }

    // 6️⃣ Create voucher
    const voucher = await prisma.voucher.create({
      data: {
        code,
        discountAmount,
        expiresAt: new Date(expiresAt),
        event: {
          connect: { id: eventId },
        },
      },
    });

    return res.status(201).json({
      message: "Voucher created successfully",
      data: voucher,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
});

//////////////////////// Attendee List (Organizer)
/* app.get(
  "/api/events/:id/attendees",
  verifyToken,
  async (req: Request, res: Response) => {
    if ((req as any).user.role !== "ORGANIZER") {
      return res
        .status(403)
        .json({ message: "Only organizer can view attendees" });
    }

    const eventId = Number(req.params.id);

    try {
      // 1️⃣ Check event exists and belongs to this organizer
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // console.log(
      //   "Event organizerId:",
      //   event.organizerId,
      //   typeof event.organizerId,
      // );
      // console.log(
      //   "Token userId:",
      //   (req as any).user.id,
      //   typeof (req as any).user.id,
      // );

      if (event.organizerId !== Number((req as any).user.id)) {
        return res.status(403).json({
          message: "You are not allowed to view this event attendees",
        });
      }

      // 2️⃣ Get accepted transactions only
      const attendees = await prisma.transaction.findMany({
        where: {
          eventId: eventId,
          status: "ACCEPTED",
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      // 3️⃣ Format response
      const result = attendees.map((trx) => ({
        transactionId: trx.id,
        name: trx.user.name,
        email: trx.user.email,
        quantity: trx.quantity,
        totalPrice: trx.totalPrice,
      }));

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  },
); */

// Upload Payment Proof
app.patch(
  "/api/transactions/:id/payment-proof",
  verifyToken,
  upload.single("paymentProof"),
  async (req: Request, res: Response) => {
    if ((req as any).user.role !== "CUSTOMER") {
      return res.status(403).json({
        message: "Only customer can upload payment proof",
      });
    }

    const transactionId = Number(req.params.id);

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Must belong to logged-in customer
      if (transaction.userId !== (req as any).user.id) {
        return res.status(403).json({
          message: "You can only upload proof for your own transaction",
        });
      }

      if (transaction.status !== "PENDING") {
        return res.status(400).json({
          message: "Cannot upload proof for finalized transaction",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded",
        });
      }

      // Convert buffer to base64
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
        "base64",
      )}`;

      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(base64Image, {
        folder: "payment-proofs",
      });

      // Save Cloudinary URL in database
      const updatedTransaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          paymentProof: uploadResult.secure_url,
        },
      });

      return res.status(200).json({
        message: "Payment proof uploaded successfully",
        data: updatedTransaction,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: "Something went wrong",
        error: error.message,
      });
    }
  },
);

// Dashboard (Organizer)
app.get(
  "/api/organizer/dashboard",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      if ((req as any).user.role !== "ORGANIZER") {
        return res.status(403).json({ message: "Only organizers allowed" });
      }

      const organizerId = (req as any).user.id;

      // Get organizer events
      const events = await prisma.event.findMany({
        where: { organizerId },
        select: { id: true },
      });

      const eventIds = events.map((e) => e.id);

      // Get accepted transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          eventId: { in: eventIds },
          status: "ACCEPTED",
        },
        select: {
          quantity: true,
          totalPrice: true,
          createdAt: true,
        },
      });

      // Pending transactions
      const pendingTransactions = await prisma.transaction.count({
        where: {
          eventId: { in: eventIds },
          status: "PENDING",
        },
      });

      // Summary stats
      const totalTicketsSold = transactions.reduce(
        (sum, t) => sum + t.quantity,
        0,
      );
      const totalRevenue = transactions.reduce(
        (sum, t) => sum + t.totalPrice,
        0,
      );

      // DAILY DATA
      const dailyMap: Record<number, { revenue: number; tickets: number }> = {};

      transactions.forEach((t) => {
        const day = new Date(t.createdAt).getDate();

        if (!dailyMap[day]) {
          dailyMap[day] = { revenue: 0, tickets: 0 };
        }

        dailyMap[day].revenue += t.totalPrice;
        dailyMap[day].tickets += t.quantity;
      });

      const dailyData = Object.entries(dailyMap).map(([day, data]) => ({
        day: Number(day),
        revenue: data.revenue,
        tickets: data.tickets,
      }));

      // MONTHLY DATA
      const monthlyMap: Record<number, { revenue: number; tickets: number }> =
        {};

      transactions.forEach((t) => {
        const month = new Date(t.createdAt).getMonth() + 1;

        if (!monthlyMap[month]) {
          monthlyMap[month] = { revenue: 0, tickets: 0 };
        }

        monthlyMap[month].revenue += t.totalPrice;
        monthlyMap[month].tickets += t.quantity;
      });

      const monthlyData = Object.entries(monthlyMap).map(([month, data]) => ({
        month: Number(month),
        revenue: data.revenue,
        tickets: data.tickets,
      }));

      res.json({
        totalEvents: events.length,
        totalTicketsSold,
        totalRevenue,
        pendingTransactions,
        dailyData,
        monthlyData,
      });
    } catch (error) {
      res.status(500).json({ message: "Dashboard error" });
    }
  },
);

// Attendee List (Organizer)
app.get(
  "/api/events/:id/attendees",
  verifyToken,
  async (req: Request, res: Response) => {
    if ((req as any).user.role !== "ORGANIZER") {
      return res.status(403).json({
        message: "Only organizers can view attendees",
      });
    }

    const organizerId = Number((req as any).user.id);
    const eventId = Number(req.params.id);

    try {
      // 1️⃣ Check if event belongs to organizer
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        return res.status(404).json({
          message: "Event not found",
        });
      }

      if (event.organizerId !== organizerId) {
        return res.status(403).json({
          message: "You do not own this event",
        });
      }

      // 2️⃣ Get attendees
      const attendees = await prisma.transaction.findMany({
        where: {
          eventId: eventId,
          status: "ACCEPTED",
        },
        select: {
          quantity: true,
          totalPrice: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      // 3️⃣ Format response
      const attendeeList = attendees.map((trx) => ({
        name: trx.user.name,
        email: trx.user.email,
        tickets: trx.quantity,
        totalPaid: trx.totalPrice,
      }));

      return res.status(200).json({
        eventId,
        attendees: attendeeList,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error.message,
      });
    }
  },
);

// Login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const userInput = req.body;

  if (!userInput.email || !userInput.password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: userInput.email },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    const isPasswordValid = await bcrypt.compare(
      userInput.password,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid password",
      });
    }

    return res.status(200).json({
      message: "User logged in successfully",
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        token,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
});

// Public Route (Upcoming Event)
app.get("/api/events/upcoming", async (req: Request, res: Response) => {
  try {
    const now = new Date();

    const events = await prisma.event.findMany({
      where: {
        eventDate: { gt: now }, // only future events
        availableSeats: { gt: 0 }, // still bookable
      },
      orderBy: {
        eventDate: "asc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        price: true,
        availableSeats: true,
        eventDate: true,
        organizer: {
          select: {
            name: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Upcoming events retrieved",
      data: events,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to fetch events",
      error: error.message,
    });
  }
});

// Public Route (Upcoming Event) per Event
app.get("/api/events/:id", async (req: Request, res: Response) => {
  const eventId = Number(req.params.id);

  if (!eventId || isNaN(eventId)) {
    return res.status(400).json({
      message: "Invalid event ID",
    });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    res.status(200).json({
      message: "Event retrieved successfully",
      data: event,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to fetch event",
      error: error.message,
    });
  }
});

// Verify Token
function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Token is required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    // simpan hasil decode ke request
    (req as any).user = decoded;

    // lanjut ke route berikutnya
    next();
  } catch (error: any) {
    return res.status(401).json({
      message: "Invalid token",
      error: error.message,
    });
  }
}

// Protected Route (Users)
// Get Users Data
app.get(
  "/api/users/profile",
  verifyToken,
  async (req: Request, res: Response) => {
    const userEmail = (req as any).user.email;

    try {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          refCode: true,
          profilePic: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.status(200).json({
        message: "Profile retrieved successfully",
        data: user,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: "Something went wrong",
        error: error.message,
      });
    }
  },
);

// Update Users Data
app.put(
  "/api/users/profile",
  verifyToken,
  async (req: Request, res: Response) => {
    const userEmail = (req as any).user.email;
    const { name, email, oldPassword, newPassword } = req.body;

    try {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
      });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      let updatedData: any = {};

      if (name) updatedData.name = name;
      if (email) updatedData.email = email;

      if (oldPassword && newPassword) {
        const isPasswordValid = await bcrypt.compare(
          oldPassword,
          user.password,
        );

        if (!isPasswordValid) {
          return res.status(401).json({
            message: "Old password is incorrect",
          });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        updatedData.password = hashedPassword;
      }

      const updatedUser = await prisma.user.update({
        where: { email: userEmail },
        data: updatedData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      return res.status(200).json({
        message: "Profile updated successfully",
        data: updatedUser,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: "Something went wrong",
        error: error.message,
      });
    }
  },
);

// Update Profile Picture
app.patch(
  "/api/users/profile-picture",
  verifyToken,
  upload.single("profilePic"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      if (!req.file) {
        return res.status(400).json({
          message: "No image uploaded",
        });
      }

      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({
          message: "Only image files are allowed",
        });
      }

      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const uploadResult = await cloudinary.uploader.upload(base64Image, {
        folder: "profile-pictures",
      });

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          profilePic: uploadResult.secure_url,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          profilePic: true,
        },
      });

      return res.status(200).json({
        message: "Profile picture updated",
        data: updatedUser,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error.message,
      });
    }
  },
);

// Forgot Password
app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Expiry (1 hour)
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);

    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: expiry,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>You requested to reset your password.</p>
        <p>Click the link below:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 1 hour.</p>
      `,
    });

    return res.status(200).json({
      message: "Password reset email sent",
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
});

// Reset Password
app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    return res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
});

// Logout
app.post("/api/auth/logout", verifyToken, (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Logout failed",
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.info(`Server is running on port ${PORT}`);
});
