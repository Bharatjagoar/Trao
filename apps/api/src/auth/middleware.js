import { verifySession } from "./jwt.js";

const COOKIE_NAME = "session";

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } });
    return;
  }

  const payload = verifySession(token);
  if (!payload) {
    res.status(401).json({ error: { code: "SESSION_EXPIRED", message: "Your session has expired. Please sign in again." } });
    return;
  }

  req.userId = payload.sub;
  next();
}

export { COOKIE_NAME };
