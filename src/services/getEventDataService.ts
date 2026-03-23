import prisma from "../lib/prisma.js";

async function getEventDataService(email: string) {
    const events = await prisma.event.findMany({
      where: {
        organizer: {
          email: email,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return events;
}

export default getEventDataService;