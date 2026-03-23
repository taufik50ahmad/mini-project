import prisma from "../lib/prisma.js";

export async function transactionService(
  { eventId, quantity, couponId, voucherCode, usePoints, userId }: {
    eventId: number,
    quantity: number,
    couponId: number,
    voucherCode: string,
    usePoints: number,
    userId: number,
  }
) {
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
          userId: userId,
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
          userId: userId,
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
        userId: userId,
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

  return result
}
