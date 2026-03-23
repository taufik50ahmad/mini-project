import prisma from "../lib/prisma.js";

async function publicUpPerEventService(eventId: number) {
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
    throw new Error("Event not found");
  }

  return {
    message: "Event retrieved successfully",
    data: event,
  };
}

export default publicUpPerEventService;
