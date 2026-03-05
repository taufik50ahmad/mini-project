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
import multer from "multer";
import cloudinary from "./utils/cloudinary.js";
// import path from "path";
import crypto from "crypto";
import nodemailer from "nodemailer";

// Multer Configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only jpeg, jpg, png, webp, and gif images are allowed"));
    }
  },
});

// Email Configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const app: Application = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get("/api/health", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ message: "API is Running!", uptime: process.uptime() });
});

// No Dupes RefCode

function generateRefCode(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function getUniqueRefCode() {
  let code = generateRefCode();
  let existing = await prisma.user.findUnique({
    where: { refCode: code },
  });

  while (existing) {
    code = generateRefCode();
    existing = await prisma.user.findUnique({
      where: { refCode: code },
    });
  }

  return code;
}

// Register
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { name, email, password, role, referralCode } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Name, email and password are required",
    });
  }

  try {
    // Check existing email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check referral
    let referrer = null;

    if (referralCode) {
      referrer = await prisma.user.findUnique({
        where: { refCode: referralCode },
      });

      if (!referrer) {
        return res.status(400).json({
          message: "Invalid referral code",
        });
      }

      if (referrer.email === email) {
        return res.status(400).json({
          message: "You cannot use your own referral code",
        });
      }
    }

    const DEFAULT_AVATAR =
      "https://res.cloudinary.com/dqa5t9ocj/image/upload/v1772699201/default-avatar_aeumky.jpg";

    // Create user
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role ?? "CUSTOMER",
        profilePic: DEFAULT_AVATAR,
        refCode: await getUniqueRefCode(),
        referredById: referrer ? referrer.id : null,
      },
    });

    // Referral reward
    if (referrer) {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 3);

      await prisma.$transaction([
        prisma.point.create({
          data: {
            userId: referrer.id,
            amount: 10000,
            expiresAt: expiry,
          },
        }),

        prisma.coupon.create({
          data: {
            userId: createdUser.id,
            discountAmount: 10000,
            expiresAt: expiry,
          },
        }),
      ]);
    }

    // Send email notification
    await transporter.sendMail({
      from: `"Event Platform" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Event Platform 🎉",
      html: `
        <h2>Welcome ${name}!</h2>
        <p>Your account has been successfully created.</p>
        <p>You can now log in and start exploring events.</p>
      `,
    });

    return res.status(201).json({
      message: "User registered successfully",
      data: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        refCode: createdUser.refCode,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
});

// Points
app.get(
  "/api/users/points",
  verifyToken,
  async (req: Request, res: Response) => {
    const userEmail = (req as any).user.email;

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();

    const activePoints = await prisma.point.findMany({
      where: {
        userId: user.id,
        expiresAt: {
          gt: now,
        },
      },
    });

    const total = activePoints.reduce((sum, p) => sum + p.amount, 0);

    return res.status(200).json({
      totalPoints: total,
      details: activePoints,
    });
  },
);

// Coupons
app.get(
  "/api/users/coupons",
  verifyToken,
  async (req: Request, res: Response) => {
    const userEmail = (req as any).user.email;

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    const now = new Date();

    const coupons = await prisma.coupon.findMany({
      where: {
        userId: user!.id,
        expiresAt: { gt: now },
        isUsed: false,
      },
    });

    return res.status(200).json({
      coupons,
    });
  },
);

// Transactions
app.post(
  "/api/transactions",
  verifyToken,
  async (req: Request, res: Response) => {
    if ((req as any).user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Only customers can purchase" });
    }

    const { eventId, quantity, couponId, voucherCode, usePoints } = req.body;

    if (!eventId || !quantity || quantity <= 0) {
      return res.status(400).json({ message: "Invalid event or quantity" });
    }

    const user = await prisma.user.findUnique({
      where: { email: (req as any).user.email },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({
          where: { id: eventId },
        });

        if (!event) throw new Error("Event not found");

        if (event.availableSeats < quantity) {
          throw new Error("Not enough seats available");
        }

        let totalPrice = event.price * quantity;
        let usedPointsAmount = 0;
        let usedCouponId: number | null = null;
        let usedVoucherId: number | null = null;

        const now = new Date();

        // ======================
        // 🎟 APPLY COUPON
        // ======================
        if (couponId) {
          const coupon = await tx.coupon.findFirst({
            where: {
              id: couponId,
              userId: user.id,
              expiresAt: { gt: now },
              isUsed: false,
            },
          });

          if (!coupon) throw new Error("Invalid coupon");

          totalPrice -= coupon.discountAmount;
          if (totalPrice < 0) totalPrice = 0;

          usedCouponId = coupon.id;

          await tx.coupon.update({
            where: { id: coupon.id },
            data: { isUsed: true },
          });
        }

        // ======================
        // 🎟 APPLY VOUCHER
        // ======================
        if (voucherCode) {
          const voucher = await tx.voucher.findFirst({
            where: {
              code: voucherCode,
              eventId: event.id,
              expiresAt: { gt: now },
            },
          });

          if (!voucher) throw new Error("Invalid voucher");

          totalPrice -= voucher.discountAmount;
          if (totalPrice < 0) totalPrice = 0;

          usedVoucherId = voucher.id;
        }

        // ======================
        // 💰 APPLY POINTS
        // ======================
        if (usePoints && totalPrice > 0) {
          const activePoints = await tx.point.findMany({
            where: {
              userId: user.id,
              expiresAt: { gt: now },
            },
            orderBy: {
              expiresAt: "asc",
            },
          });

          const totalAvailablePoints = activePoints.reduce(
            (sum, p) => sum + p.amount,
            0,
          );

          if (totalAvailablePoints > 0) {
            let remainingToDeduct = Math.min(totalAvailablePoints, totalPrice);

            for (const point of activePoints) {
              if (remainingToDeduct <= 0) break;

              const deductAmount = Math.min(point.amount, remainingToDeduct);

              usedPointsAmount += deductAmount;
              remainingToDeduct -= deductAmount;

              if (deductAmount === point.amount) {
                await tx.point.delete({
                  where: { id: point.id },
                });
              } else {
                await tx.point.update({
                  where: { id: point.id },
                  data: {
                    amount: point.amount - deductAmount,
                  },
                });
              }
            }

            totalPrice -= usedPointsAmount;
          }
        }

        if (totalPrice < 0) totalPrice = 0;

        // ======================
        // 🎟 REDUCE SEATS
        // ======================
        await tx.event.update({
          where: { id: event.id },
          data: {
            availableSeats: {
              decrement: quantity,
            },
          },
        });

        const transaction = await tx.transaction.create({
          data: {
            userId: user.id,
            eventId: event.id,
            quantity,
            totalPrice,
            usedPoints: usedPointsAmount,
            usedCouponId,
            usedVoucherId,
          },
        });

        return transaction;
      });

      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  },
);
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
app.post("/api/events", verifyToken, async (req: Request, res: Response) => {
  if ((req as any).user.role !== "ORGANIZER") {
    return res
      .status(403)
      .json({ message: "Only organizers can create events" });
  }

  const { title, description, location, price, totalSeats, eventDate } =
    req.body;

  try {
    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        price,
        totalSeats,
        availableSeats: totalSeats,
        eventDate: new Date(eventDate),

        organizer: {
          connect: {
            email: (req as any).user.email,
          },
        },
      },
    });

    return res.status(201).json(event);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
});

// Get Event Data (Organizer)
app.get(
  "/api/organizer/events",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      if ((req as any).user.role !== "ORGANIZER") {
        return res.status(403).json({ message: "Only organizers allowed" });
      }

      const events = await prisma.event.findMany({
        where: {
          organizer: {
            email: (req as any).user.email,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  },
);

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
app.delete(
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

      await prisma.event.delete({
        where: { id: eventId },
      });

      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  },
);

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

// Attendee List (Organizer)
app.get(
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
);

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

// Attendee List
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

app.listen(PORT, () => {
  console.info(`Server is running on port ${PORT}`);
});
