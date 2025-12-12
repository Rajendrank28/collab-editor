import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes";
import snippetRoutes from "./routes/snippetRoutes";

const app: Application = express();

app.use(helmet());
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use("/api", apiLimiter);

// health route
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// auth
app.use("/api/auth", authRoutes);

// snippets
app.use("/api/snippets", snippetRoutes);

export default app;
