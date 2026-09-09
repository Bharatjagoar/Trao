import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import authRoutes from "./auth/routes.js";
import kitsRoutes from "./routes/kits.js";
import { swaggerSpec } from "./docs/swagger.js";

export function createServer() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Liveness check
   *     tags: [Kits]
   *     responses:
   *       200:
   *         description: API is up
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok: { type: boolean }
   */
  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/docs.json", (_req, res) => res.json(swaggerSpec));

  app.use("/api/auth", authRoutes);
  app.use("/api/kits", kitsRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
  });

  return app;
}
