import prisma from "../lib/prisma.js";

async function attendeeListService(organizerId: number, eventId: number) {
  // 1️⃣ Check if event belongs to organizer
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.organizerId !== organizerId) {
    throw new Error("You do not own this event");
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

  return { eventId, attendees: attendeeList };
}

export default attendeeListService;
