import mongoose from "mongoose";
import { env } from "../config/env.js";

let connected = false;

export async function connectDb() {
  if (connected) return;
  await mongoose.connect(env.mongodbUri);
  connected = true;
}

export async function disconnectDb() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
