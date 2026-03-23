import prisma from "../lib/prisma.js";
import { getUniqueRefCode } from "./getRefCode.js";
import bcrypt from "bcrypt";
import { Role } from "../generated/prisma/enums.js";

export async function registerService(name: string, email: string, password: string, role: Role, referralCode: any) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check referral
    let referrer = null;

    if (referralCode) {
      referrer = await prisma.user.findUnique({
        where: { refCode: referralCode },
      });

      if (!referrer) {
        throw new Error("Invalid referral code");
      }
    }

    const DEFAULT_AVATAR = process.env.CLOUDINARY_DEFAULT_AVATAR!;

    // Create user
    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role ?? Role.CUSTOMER,
        profilePic: DEFAULT_AVATAR,
        refCode: await getUniqueRefCode(),
        referredById: referrer ? referrer.id : null,
      },
    });
}