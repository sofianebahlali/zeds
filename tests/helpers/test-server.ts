import { createServer, type Server as HttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { RoomManager } from "../../server/room-manager";
import { setupSocketHandlers } from "../../server/socket-handlers";
import type { ClientToServerEvents, ServerToClientEvents, GameModeConfig } from "../../src/types";

/**
 * A real Socket.IO server wired to the real handlers, on an ephemeral port.
 *
 * The room manager, the game engine and the socket handlers only make sense
 * together — a mocked `io` would test the mock. The one thing left out is the
 * room-cleanup interval, which tests drive explicitly instead.
 */
export interface TestServer {
  url: string;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  roomManager: RoomManager;
  close: () => Promise<void>;
}

export type TestClient = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

export async function startTestServer(): Promise<TestServer> {
  const httpServer: HttpServer = createServer();
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    // Mirrors server/index.ts, minus connectionStateRecovery: replaying packets
    // across a reconnect would mask the very gaps these tests probe.
    pingInterval: 20_000,
    pingTimeout: 25_000,
    maxHttpBufferSize: 2e6,
  });

  const roomManager = new RoomManager();
  setupSocketHandlers(io, roomManager);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    io,
    roomManager,
    close: () =>
      new Promise<void>((resolve) => {
        io.close(() => httpServer.close(() => resolve()));
      }),
  };
}

/**
 * A client that re-sends its identity on every connection attempt, exactly the
 * way `src/lib/socket.ts` does.
 */
export function createClient(
  url: string,
  auth: { playerId?: string; roomCode?: string } = {}
): TestClient {
  return ioClient(url, {
    autoConnect: false,
    transports: ["websocket"],
    reconnection: false,
    auth: (cb: (data: Record<string, unknown>) => void) => cb({ ...auth }),
  }) as TestClient;
}

/**
 * The typed client only accepts declared event names. Tests deliberately wait
 * on events by string, so listener plumbing goes through this loose view.
 */
interface LooseEmitter {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  once(event: string, handler: (...args: unknown[]) => void): void;
}

const loose = (socket: TestClient) => socket as unknown as LooseEmitter;

/** Resolve with the arguments of the next `event`, or reject on timeout. */
export function waitFor<T extends unknown[] = unknown[]>(
  socket: TestClient,
  event: string,
  timeoutMs = 8000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      loose(socket).off(event, handler);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for "${event}"`));
    }, timeoutMs);

    function handler(...args: unknown[]) {
      clearTimeout(timer);
      resolve(args as T);
    }

    loose(socket).once(event, handler);
  });
}

/** Resolve as soon as `event` fires, or with `null` once `withinMs` elapses. */
export function waitForMaybe<T extends unknown[] = unknown[]>(
  socket: TestClient,
  event: string,
  withinMs: number
): Promise<T | null> {
  return waitFor<T>(socket, event, withinMs).catch(() => null);
}

/** Record every occurrence of `event` for later assertions. */
export function collect<T extends unknown[] = unknown[]>(socket: TestClient, event: string): T[] {
  const seen: T[] = [];
  loose(socket).on(event, (...args: unknown[]) => seen.push(args as T));
  return seen;
}

export async function connect(socket: TestClient): Promise<void> {
  socket.connect();
  await waitFor(socket, "connect");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Create a room and return its code. The playlist is forced so tests never
 * depend on whichever modes the default playlist happens to hold.
 */
export async function createRoom(
  server: TestServer,
  opts: {
    playerId?: string;
    name?: string;
    playlist?: GameModeConfig[];
    settings?: Record<string, unknown>;
  } = {}
): Promise<{ host: TestClient; code: string }> {
  const playerId = opts.playerId ?? "host";
  const host = createClient(server.url, { playerId });
  await connect(host);

  host.emit("room:create", opts.name ?? "Hôte", "🦊", playerId);
  const [room] = await waitFor<[{ code: string }]>(host, "room:joined");

  if (opts.playlist || opts.settings) {
    host.emit("room:update_settings", {
      ...(opts.playlist ? { playlist: opts.playlist } : {}),
      ...(opts.settings ?? {}),
    } as never);
    await waitFor(host, "room:settings_updated");
  }

  return { host, code: room.code };
}

export async function joinRoom(
  server: TestServer,
  code: string,
  playerId: string,
  name = playerId
): Promise<TestClient> {
  const client = createClient(server.url, { playerId });
  await connect(client);
  client.emit("room:join", code, name, "🐼", playerId);
  await waitFor(client, "room:joined");
  return client;
}
