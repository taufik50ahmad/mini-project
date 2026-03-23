import { registerSchema } from "../validators/auth.validate.js";
import type { Request, Response } from "express";
import { registerService } from "../services/registerService.js";
import z from "zod";
import { Role } from "../generated/prisma/enums.js";

export async function registerController(req: Request, res: Response) {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: z.treeifyError(validation.error),
    });
  }

  const { name, email, password, role, referralCode } = validation.data;

  try {
    const safeRole: Role =
      role === "ORGANIZER" ? Role.ORGANIZER : Role.CUSTOMER;

    const createdUser = await registerService(
      name,
      email,
      password,
      safeRole,
      referralCode,
    );

    return res.status(201).json({
      message: "User registered successfully",
      data: createdUser,
    });
  } catch (error: any) {
    if (error.message === "Email already exists") {
      return res.status(409).json({
        message: error.message,
      });
    }

    if (error.message === "Invalid referral code") {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
}
