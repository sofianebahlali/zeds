import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { RoomManager } from "./room-manager";
import { setupSocketHandlers, startRoomCleanup } from "./socket-handlers";
import { warmFootballDb } from "./football-db";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/types";

const app = express();
const httpServer = createServer(app);

// Configure CORS - allow Codespace origins
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Allow all GitHub Codespace origins
  if (origin.endsWith(".app.github.dev")) return true;
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
}));

app.use(express.json());

// Create Socket.IO server with types
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
  },
  // Detect dead mobile sockets in ~45s instead of ~85s, so a backgrounded
  // player is marked disconnected (and their teammates told) promptly.
  pingInterval: 20000,
  pingTimeout: 25000,
  maxHttpBufferSize: 2e6, // 2MB for base64 drawing images
  // Replay packets missed during a short drop and keep the socket's rooms.
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

// Initialize room manager
const roomManager = new RoomManager();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: roomManager.getRoomCount(),
    players: roomManager.getTotalPlayerCount(),
  });
});

// API endpoint to get room info (for join validation)
app.get("/api/rooms/:code", (req, res) => {
  const room = roomManager.getRoom(req.params.code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }
  return res.json({
    code: room.code,
    playerCount: room.players.length,
    maxPlayers: room.settings.maxPlayers,
    status: room.status,
    gameMode: room.gameMode,
  });
});

// Setup socket handlers
setupSocketHandlers(io, roomManager);

// Cleanup interval - remove inactive rooms (and their game engines)
startRoomCleanup(roomManager);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);

  const warmStart = Date.now();
  warmFootballDb()
    .then(() => console.log(`⚽ Football DB warmed in ${Date.now() - warmStart}ms`))
    .catch((error) => console.warn("Football DB warmup failed:", error));
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
