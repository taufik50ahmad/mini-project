import prisma from "../lib/prisma.js";
import cloudinary from "../utils/cloudinary.js";

async function uploadPaymentService(
  transactionId: number,
  file: Express.Multer.File,
  userId: number,
) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  // Must belong to logged-in customer
  if (transaction.userId !== userId) {
    throw new Error("You can only upload proof for your own transaction");
  }

  if (transaction.status !== "PENDING") {
    throw new Error("Cannot upload proof for finalized transaction");
  }

  if (!file) {
    throw new Error("No file uploaded");
  }

  // Convert buffer to base64
  const base64Image = `data:${file.mimetype};base64,${file.buffer.toString(
    "base64",
  )}`;

  // Upload to Cloudinary
  const uploadResult = await cloudinary.uploader.upload(base64Image, {
    folder: "payment-proofs",
  });

  // Save Cloudinary URL in database
  const updatedTransaction = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      paymentProof: uploadResult.secure_url,
    },
  });

  return updatedTransaction;
}

export default uploadPaymentService;
