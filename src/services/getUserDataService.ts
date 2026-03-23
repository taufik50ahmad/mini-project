import prisma from "../lib/prisma.js";

async function getUserDataService(userEmail: string) {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      refCode: true,
      profilePic: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    message: "Profile retrieved successfully",
    data: user,
  };
}

export default getUserDataService;
