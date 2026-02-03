import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { RoomManager } from "./room-manager";
import { setupSocketHandlers } from "./socket-handlers";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  // Create Socket.IO server
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Initialize room manager
  const roomManager = new RoomManager();

  // Health check endpoint
  expressApp.get("/health", (req, res) => {
    res.json({
      status: "ok",
      rooms: roomManager.getRoomCount(),
      players: roomManager.getTotalPlayerCount(),
    });
  });

  // API endpoint to get room info
  expressApp.get("/api/rooms/:code", (req, res) => {
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
  }, 60000);

  // Handle all other routes with Next.js
  expressApp.all("*", (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Server running on http://${hostname}:${port}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🌍 Mode: ${dev ? "development" : "production"}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down...");
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
});
