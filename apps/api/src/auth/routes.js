import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "./hash.js";
import { signSession } from "./jwt.js";
import { requireAuth, COOKIE_NAME } from "./middleware.js";
import { env } from "../config/env.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Frontend and backend are deployed on different origins (e.g. Vercel +
// Render), so the session cookie must be sent on cross-site fetch requests.
// That requires SameSite=None, which in turn requires Secure — so this only
// takes effect in production; local dev falls back to Lax over http.
const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post("/register", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input" },
    });
    return;
  }

  const { email, password } = parsed.data;
  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: { code: "EMAIL_TAKEN", message: "An account with that email already exists." } });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, passwordHash });
  const token = signSession({ sub: String(user._id), email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.status(201).json({ user: { id: user._id, email: user.email } });
});

router.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });
    return;
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });
    return;
  }

  const token = signSession({ sub: String(user._id), email: user.email });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  res.json({ user: { id: user._id, email: user.email } });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } });
    return;
  }
  res.json({ user: { id: user._id, email: user.email } });
});

export default router;
