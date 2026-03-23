import prisma from "../lib/prisma.js";

async function createEventService(
  title: string,
  description: string,
  location: string,
  price: number,
  totalSeats: number,
  eventDate: Date,
  email: string,
) {
  const event = await prisma.event.create({
    data: {
      title,
      description,
      location,
      price,
      totalSeats,
      availableSeats: totalSeats,
      eventDate: new Date(eventDate),

      organizer: {
        connect: {
          email: email,
        },
      },
    },
  });

  return event;
}

export default createEventService;
