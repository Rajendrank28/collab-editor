// backend/src/server.ts
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import { Server as IOServer } from "socket.io";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";

import snippetRoutes from "./routes/snippetRoutes";
import authRoutes from "./routes/authRoutes";
import { snippetSocket } from "./sockets/snippetSocket";
import { redis as redisStorage } from "./config/redis";
import { startAutoSave } from "./jobs/autoSave";

import apiLimiter, { authLimiter, speedLimiter } from "./middleware/rateLimit";

const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || "";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(
    cors({
      origin: "http://localhost:5173",
      credentials: true,
    })
  );

  // Rate limiting middleware
  app.use("/api", speedLimiter);
  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter);

  // Routes
  app.use("/api/snippets", snippetRoutes);
  app.use("/api/auth", authRoutes);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  const httpServer = http.createServer(app);

  // Socket.IO
  const io = new IOServer(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Redis adapter
  const pubClient = new Redis(REDIS_URL);
  const subClient = pubClient.duplicate();
  await Promise.all([
    new Promise<void>((res) => pubClient.once("ready", () => res())),
    new Promise<void>((res) => subClient.once("ready", () => res())),
  ]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log("🔁 Socket.IO adapter (Redis) configured");

  // Socket handshake JWT verification
  io.use((socket, next) => {
    try {
      // Accept token via socket.handshake.auth.token (client sets auth: { token } )
      const token = socket.handshake.auth?.token || null;
      if (!token) {
        console.warn("Socket connection rejected: no token provided");
        return next(new Error("Authentication error: token required"));
      }
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; username?: string };
        // Store user info on socket.data for handlers
        (socket as any).data = { ...(socket as any).data, userId: decoded.userId, username: decoded.username || null };
        return next();
      } catch (err) {
        console.warn("Socket connection rejected: invalid token");
        return next(new Error("Authentication error: invalid token"));
      }
    } catch (err) {
      console.error("Socket auth middleware error", err);
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("🟢 socket connected:", socket.id, "user:", (socket as any).data?.username ?? (socket as any).data?.userId);
    snippetSocket(io, socket);
  });

  // MongoDB connect
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }

  redisStorage.on("connect", () => console.log("🔌 Redis connected"));
  redisStorage.on("error", (err) => console.error("❌ Redis error:", err));

  // start auto-save job
  const autoSaveHandle = startAutoSave(redisStorage, 30_000);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });

  // graceful shutdown
  const shutdown = async () => {
    console.log("🛑 Shutting down...");
    try {
      autoSaveHandle.stop();
      await io.close();
      await mongoose.disconnect();
      await pubClient.quit();
      await subClient.quit();
      process.exit(0);
    } catch (err) {
      console.error("Shutdown error:", err);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startServer().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
