import z from "zod";

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),

    email: z.string().pipe(z.email({ message: "Invalid email format" })),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must include one uppercase letter")
      .regex(/[a-z]/, "Must include one lowercase letter")
      .regex(/[0-9]/, "Must include one number")
      .regex(/[^A-Za-z0-9]/, "Must include at least one special character"),

    confirmPassword: z.string(),

    role: z.enum(["CUSTOMER", "ORGANIZER"]).optional(),

    referralCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
