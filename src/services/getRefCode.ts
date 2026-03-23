import prisma from "../lib/prisma.js";
import { generateRefCode } from "../utils/genRefCode.js";

export async function getUniqueRefCode() {
  let code = generateRefCode();
  let existing = await prisma.user.findUnique({
    where: { refCode: code },
  });

  while (existing) {
    code = generateRefCode();
    existing = await prisma.user.findUnique({
      where: { refCode: code },
    });
  }

  return code;
}