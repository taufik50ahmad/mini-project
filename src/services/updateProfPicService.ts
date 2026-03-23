import prisma from "../lib/prisma.js";
import cloudinary from "../utils/cloudinary.js";

async function updateProfPicService(file: Express.Multer.File, userId: number) {
  if (!file) {
    throw new Error("No image uploaded");
  }

  if (!file.mimetype.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  const uploadResult = await cloudinary.uploader.upload(base64Image, {
    folder: "profile-pictures",
  });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      profilePic: uploadResult.secure_url,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profilePic: true,
    },
  });

  return {
    message: "Profile picture updated",
    data: updatedUser,
  };
}

export default updateProfPicService;
