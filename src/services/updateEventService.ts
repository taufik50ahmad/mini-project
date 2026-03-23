import prisma from "../lib/prisma.js";

async function updateEventService(eventId: number, email: string, data: any) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizer: {
        email,
      },
    },
  });

  if (!event) {
    throw new Error("Event not found or not yours");
  }

  // Remove undefined fields
  const filteredData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined),
  ); //

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: filteredData,
  });

  return { message: "Event updated successfully", updatedEvent };
}

export default updateEventService;
