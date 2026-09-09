import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongodbUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/trao-interview-kit",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
};
