import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { RoomManager } from "./room-manager";
import { setupSocketHandlers, startRoomCleanup } from "./socket-handlers";
import { warmFootballDb } from "./football-db";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/types";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  // Initialize Next.js in production mode
  const nextApp = next({ dev: false });
  const nextHandler = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = express();
  const httpServer = createServer(app);

  // Socket.IO — no CORS needed (same origin in production)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
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

  const roomManager = new RoomManager();

  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      rooms: roomManager.getRoomCount(),
      players: roomManager.getTotalPlayerCount(),
    });
  });

  // API: room info
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

  // Socket handlers
  setupSocketHandlers(io, roomManager);

  // Cleanup inactive rooms (and their game engines) every minute
  startRoomCleanup(roomManager);

  // Next.js handles everything else (pages, /_next/static, public assets)
  app.all("*", (req, res) => {
    return nextHandler(req, res);
  });

  httpServer.listen(PORT, () => {
    console.log(`Production server running on port ${PORT}`);
    console.log(`Next.js + Express + Socket.IO on single port`);

    const warmStart = Date.now();
    warmFootballDb()
      .then(() => console.log(`Football DB warmed in ${Date.now() - warmStart}ms`))
      .catch((error) => console.warn("Football DB warmup failed:", error));
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down...");
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error("Failed to start production server:", err);
  process.exit(1);
});
