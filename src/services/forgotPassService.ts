import prisma from "../lib/prisma.js";
import crypto from "crypto";
import transporter from "../utils/transporter.js";

async function forgotPassService(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Generate token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Expiry (1 hour)
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);

  await prisma.user.update({
    where: { email },
    data: {
      resetPasswordToken: resetToken,
      resetPasswordExpiry: expiry,
    },
  });

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  // Send email
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset Request",
    html: `
        <h2>Password Reset</h2>
        <p>You requested to reset your password.</p>
        <p>Click the link below:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 1 hour.</p>
      `,
  });

  return {
    message: "Password reset email sent",
  };
}

export default forgotPassService;
