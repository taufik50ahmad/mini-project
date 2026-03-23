import prisma from "../lib/prisma.js";

async function dashboardService(organizerId: number) {
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
  const totalRevenue = transactions.reduce((sum, t) => sum + t.totalPrice, 0);

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
  const monthlyMap: Record<number, { revenue: number; tickets: number }> = {};

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

  return {
    totalEvents: events.length,
    totalTicketsSold,
    totalRevenue,
    pendingTransactions,
    dailyData,
    monthlyData,
  };
}

export default dashboardService;