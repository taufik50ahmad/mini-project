import prisma from "../lib/prisma.js";

async function voucherService(code: string, discountAmount: number, eventId: number, expiresAt: Date, email: string) {
  // 2️⃣ Basic validation
  if (!code || !discountAmount || !eventId || !expiresAt) {
    throw new Error("code, discountAmount, eventId, and expiresAt are required");
  }

  // 3️⃣ Get logged-in organizer
  const organizer = await prisma.user.findUnique({
    where: { email: email },
  });

  if (!organizer) {
    throw new Error("Organizer not found");
  }

  // 4️⃣ Make sure event belongs to this organizer
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      organizerId: organizer.id,
    },
  });

  if (!event) {
    throw new Error("You can only create voucher for your own event");
  }

  // 5️⃣ Check duplicate voucher code
  const existingVoucher = await prisma.voucher.findUnique({
    where: { code },
  });

  if (existingVoucher) {
    throw new Error("Voucher code already exists");
  }

  // 6️⃣ Create voucher
  const voucher = await prisma.voucher.create({
    data: {
      code,
      discountAmount,
      expiresAt: new Date(expiresAt),
      event: {
        connect: { id: eventId },
      },
    },
  });

  return voucher;
}

export default voucherService;