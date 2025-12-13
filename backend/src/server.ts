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

import apiLimiter, {
  authLimiter,
  speedLimiter,
} from "./middleware/rateLimit";

const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || "";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey123";

async function startServer() {
  const app = express();

  app.use(express.json());

  // =========================
  // CORS (EXPRESS)
  // =========================
  app.use(
    cors({
      origin: (origin, callback) => {
        // allow requests with no origin (Postman, curl)
        if (!origin) return callback(null, true);

        // allow localhost
        if (origin.startsWith("http://localhost")) {
          return callback(null, true);
        }

        // allow all Vercel deployments
        if (origin.endsWith(".vercel.app")) {
          return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );

  // =========================
  // RATE LIMITING
  // =========================
  app.use("/api", speedLimiter);
  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter);

  // =========================
  // ROUTES
  // =========================
  app.use("/api/snippets", snippetRoutes);
  app.use("/api/auth", authRoutes);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const httpServer = http.createServer(app);

  // =========================
  // SOCKET.IO
  // =========================
  const io = new IOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (origin.startsWith("http://localhost")) {
          return callback(null, true);
        }

        if (origin.endsWith(".vercel.app")) {
          return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // =========================
  // REDIS SOCKET ADAPTER
  // =========================
  const pubClient = new Redis(REDIS_URL);
  const subClient = pubClient.duplicate();

  await Promise.all([
    new Promise<void>((res) => pubClient.once("ready", () => res())),
    new Promise<void>((res) => subClient.once("ready", () => res())),
  ]);

  io.adapter(createAdapter(pubClient, subClient));
  console.log("🔁 Socket.IO adapter (Redis) configured");

  // =========================
  // SOCKET AUTH (JWT)
  // =========================
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || null;

      if (!token) {
        console.warn("Socket rejected: no token");
        return next(new Error("Authentication error: token required"));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId?: string;
        username?: string;
      };

      (socket as any).data = {
        userId: decoded.userId,
        username: decoded.username || null,
      };

      next();
    } catch (err) {
      console.warn("Socket rejected: invalid token");
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      "🟢 socket connected:",
      socket.id,
      "user:",
      (socket as any).data?.username ?? (socket as any).data?.userId
    );

    snippetSocket(io, socket);
  });

  // =========================
  // MONGODB
  // =========================
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }

  // =========================
  // REDIS
  // =========================
  redisStorage.on("connect", () => console.log("🔌 Redis connected"));
  redisStorage.on("error", (err) => console.error("❌ Redis error:", err));

  // =========================
  // AUTO SAVE JOB
  // =========================
  const autoSaveHandle = startAutoSave(redisStorage, 30_000);

  // =========================
  // START SERVER
  // =========================
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });

  // =========================
  // GRACEFUL SHUTDOWN
  // =========================
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
