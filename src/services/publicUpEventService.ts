import prisma from "../lib/prisma.js";

async function publicUpEventService() {
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

  return {
    message: "Upcoming events retrieved",
    data: events,
  };
}

export default publicUpEventService;
