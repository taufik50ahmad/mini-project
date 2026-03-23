import prisma from "../lib/prisma.js";

async function transactionCheckService(email: string){
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      throw new Error("User not found");
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

    return transactions;
}

export default transactionCheckService;