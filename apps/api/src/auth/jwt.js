import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signSession(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

export function verifySession(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}
