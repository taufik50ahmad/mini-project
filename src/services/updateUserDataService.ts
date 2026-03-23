import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

async function updateUserDataService(
  userEmail: string,
  name: string,
  email: string,
  oldPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!user) {
    throw new Error("User not found");
  }

  let updatedData: any = {};

  if (name) updatedData.name = name;
  if (email) updatedData.email = email;

  if (oldPassword && newPassword) {
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      throw new Error("Old password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    updatedData.password = hashedPassword;
  }

  const updatedUser = await prisma.user.update({
    where: { email: userEmail },
    data: updatedData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  return {
    message: "Profile updated successfully",
    data: updatedUser,
  };
}

export default updateUserDataService;
