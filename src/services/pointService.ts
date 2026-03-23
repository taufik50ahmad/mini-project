import prisma from "../lib/prisma.js";

export async function pointService(userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    throw new Error("User not found");
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

  return {
    totalPoints: total,
    details: activePoints,
  };
}