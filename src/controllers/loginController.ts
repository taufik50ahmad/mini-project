import type { Request, Response } from "express";
import loginService from "../services/loginService.js";

async function loginController(req: Request, res: Response) {
  const userInput = req.body;

  if (!userInput.email || !userInput.password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const result = await loginService(userInput.email, userInput.password);

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({
      message: "Something went wrong",
      error: error.message,
    });
  }
}

export default loginController;
