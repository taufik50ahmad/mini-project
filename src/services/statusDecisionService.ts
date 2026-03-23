import prisma from "../lib/prisma.js";
import transporter from "../utils/transporter.js";
import type { TransactionStatus } from "../generated/prisma/client.js";

async function statusDecisionService(transactionId: number, status: TransactionStatus, userId: number) {
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
    if (transaction.event.organizerId !== userId) {
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

  return {
    message: `Transaction ${status}`,
    transaction: result,
  };
}

export default statusDecisionService;