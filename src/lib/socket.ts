"use client";

import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types";

// Socket configuration - auto-detect environment
function getSocketUrl(): string {
  // Explicit override via env variable
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;

    // GitHub Codespace dev: backend runs on separate port
    if (hostname.endsWith(".app.github.dev")) {
      const backendHost = hostname.replace(/-3000\./, "-3001.");
      return `${protocol}//${backendHost}`;
    }

    // Local development: backend on port 3001
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:3001`;
    }

    // Production: same origin (single-port deployment)
    return window.location.origin;
  }

  return "http://localhost:3001";
}

const SOCKET_URL = getSocketUrl();

// Create a typed socket
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

/**
 * Identity sent with every connection attempt (including reconnections), so
 * the server can re-attach the socket to its player before processing any
 * packet. Kept outside the store to avoid a dependency cycle — `use-socket`
 * keeps it in sync.
 */
let handshakeAuth: { playerId?: string; roomCode?: string } = {};

export function setSocketAuth(auth: { playerId?: string; roomCode?: string }): void {
  handshakeAuth = auth;
  if (socket) {
    socket.auth = { ...auth };
  }
}

export function getSocketAuth(): { playerId?: string; roomCode?: string } {
  return handshakeAuth;
}

/**
 * Get or create the socket instance
 */
export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      // Default order on purpose: HTTP long-polling first, then upgrade to
      // WebSocket. Going websocket-first fails outright on mobile networks and
      // captive proxies that block the upgrade, and every failed attempt
      // surfaces as a connect_error.
      transports: ["polling", "websocket"],
      // Re-evaluated on every (re)connection attempt.
      auth: (cb: (data: Record<string, unknown>) => void) => cb({ ...handshakeAuth }),
    }) as TypedSocket;
  }
  return socket;
}

/**
 * Connect the socket
 */
export function connectSocket(): TypedSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

/**
 * Disconnect the socket
 */
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

/**
 * Check if socket is connected
 */
export function isConnected(): boolean {
  return socket?.connected ?? false;
}
