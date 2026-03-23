import prisma from "../lib/prisma.js";

export async function couponService(userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

    if (!user) {
      throw new Error("User not found");
    }

    const now = new Date();

    const coupons = await prisma.coupon.findMany({
      where: {
        userId: user.id,
        expiresAt: { gt: now },
        isUsed: false,
      },
    });

    return {
      coupons,
    };
}