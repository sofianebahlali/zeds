import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { RoomManager } from "./room-manager";
import { setupSocketHandlers } from "./socket-handlers";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/types";

const app = express();
const httpServer = createServer(app);

// Configure CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST"],
}));

app.use(express.json());

// Create Socket.IO server with types
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
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

// Cleanup interval - remove inactive rooms
setInterval(() => {
  roomManager.cleanupInactiveRooms();
}, 60000); // Every minute

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
