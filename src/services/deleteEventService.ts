import prisma from "../lib/prisma.js";

async function deleteEventService(eventId: number, email: string) {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        organizer: {
          email: email,
        },
      },
    });

    if (!event) {
      throw new Error("Event not found or not yours");
    }

    await prisma.event.delete({
      where: { id: eventId },
    });

    return {message: "Event Successfully Deleted"}
}

export default deleteEventService;