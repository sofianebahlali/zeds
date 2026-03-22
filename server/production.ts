import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { RoomManager } from "./room-manager";
import { setupSocketHandlers } from "./socket-handlers";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/types";

const PORT = parseInt(process.env.PORT || "3000", 10);

async function main() {
  const app = express();
  const httpServer = createServer(app);

  // Track readiness — health check responds immediately, app routes wait
  let nextHandler: ((req: any, res: any) => void) | null = null;
  let isReady = false;

  const roomManager = new RoomManager();

  app.use(express.json());

  // Health check — responds immediately so Render knows the process is alive
  app.get("/health", (_req, res) => {
    res.json({
      status: isReady ? "ok" : "starting",
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

  // Socket.IO — no CORS needed (same origin in production)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 2e6, // 2MB for base64 drawing images
  });

  setupSocketHandlers(io, roomManager);

  // Cleanup inactive rooms every minute
  setInterval(() => roomManager.cleanupInactiveRooms(), 60000);

  // Next.js handles everything else — proxy only when ready
  app.all("*", (req, res) => {
    if (!nextHandler) {
      return res.status(503).send("Server is starting, please wait...");
    }
    return nextHandler(req, res);
  });

  // Start HTTP server FIRST so health check is reachable
  httpServer.listen(PORT, () => {
    console.log(`HTTP server listening on port ${PORT}`);
  });

  // THEN prepare Next.js (slow, memory-intensive)
  console.log("Preparing Next.js...");
  const nextApp = next({ dev: false });
  await nextApp.prepare();
  nextHandler = nextApp.getRequestHandler();
  isReady = true;
  console.log("Next.js ready — server fully operational");

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
