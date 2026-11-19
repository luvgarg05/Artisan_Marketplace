// This file loads the environment variables before anything else.
import './config/dotenv.js';

import express from "express";
import mongoose from "mongoose";
import cors from "cors";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import productRoutes from './routes/productRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Fail fast if the secrets the app depends on are missing.
for (const key of ["MONGO_URI", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`❌ ${key} is missing from backend/.env`);
    process.exit(1);
  }
}

// Middleware
// CORS: set ALLOWED_ORIGINS in .env to a comma-separated list of frontend URLs
// (e.g. https://your-app.vercel.app,http://localhost:3000). If it is unset,
// all origins are allowed, which is only meant for local development.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// --- API Routes ---
app.use("/api/users", userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/ai', aiRoutes);

// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- Start Server ---
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
