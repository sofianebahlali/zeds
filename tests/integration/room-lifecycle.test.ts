import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  startTestServer,
  createClient,
  createRoom,
  joinRoom,
  connect,
  waitFor,
  waitForMaybe,
  collect,
  type TestServer,
  type TestClient,
} from "../helpers/test-server";
import type { Player, Room } from "../../src/types";

describe("room lifecycle", () => {
  let server: TestServer;
  const clients: TestClient[] = [];

  const track = <T extends TestClient>(c: T) => {
    clients.push(c);
    return c;
  };

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    await server.close();
  });

  it("creates a room with a 4-character code and the creator as host", async () => {
    const host = track(createClient(server.url, { playerId: "p1" }));
    await connect(host);

    host.emit("room:create", "Alice", "🦊", "p1");
    const [room, player] = await waitFor<[Room, Player]>(host, "room:joined");

    expect(room.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(room.status).toBe("waiting");
    expect(room.hostId).toBe("p1");
    expect(player.isHost).toBe(true);
    expect(room.players).toHaveLength(1);
  });

  it("lets a second player join and tells the host about it", async () => {
    const { host, code } = await createRoom(server);
    track(host);

    const joined = waitFor<[Player]>(host, "room:player_joined");
    const guest = track(await joinRoom(server, code, "p2", "Bob"));

    const [newPlayer] = await joined;
    expect(newPlayer.name).toBe("Bob");
    expect(newPlayer.isHost).toBe(false);

    expect(server.roomManager.getRoom(code)!.players).toHaveLength(2);
    expect(guest.connected).toBe(true);
  });

  it("rejects an unknown room code", async () => {
    const client = track(createClient(server.url, { playerId: "p9" }));
    await connect(client);

    client.emit("room:join", "ZZZZ", "Ghost", "👻", "p9");
    const [message] = await waitFor<[string]>(client, "room:error");
    expect(message).toBe("Room introuvable");
  });

  it("refuses a newcomer once the room is full", async () => {
    const { host, code } = await createRoom(server, { settings: { maxPlayers: 2 } });
    track(host);
    track(await joinRoom(server, code, "p2"));

    const late = track(createClient(server.url, { playerId: "p3" }));
    await connect(late);
    late.emit("room:join", code, "Late", "🐧", "p3");

    const [message] = await waitFor<[string]>(late, "room:error");
    expect(message).toBe("La room est pleine");
  });

  it("propagates ready state and settings to everyone", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const readySeen = waitFor<[string, boolean]>(host, "room:player_ready");
    guest.emit("room:ready", true);
    expect(await readySeen).toEqual(["p2", true]);

    const settingsSeen = waitFor<[{ roundDuration: number }]>(guest, "room:settings_updated");
    host.emit("room:update_settings", { roundDuration: 45 });
    const [settings] = await settingsSeen;
    expect(settings.roundDuration).toBe(45);
  });

  it("ignores settings updates from a non-host", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    guest.emit("room:update_settings", { roundDuration: 99 });
    expect(await waitForMaybe(host, "room:settings_updated", 300)).toBeNull();
    expect(server.roomManager.getRoom(code)!.settings.roundDuration).not.toBe(99);
  });

  it("recomputes totalRounds from the playlist", async () => {
    const { host, code } = await createRoom(server, {
      playlist: [
        { mode: "open", rounds: 3 },
        { mode: "estimation", rounds: 2 },
      ],
    });
    track(host);

    expect(server.roomManager.getRoom(code)!.settings.totalRounds).toBe(5);
    expect(server.roomManager.getRoom(code)!.totalRounds).toBe(5);
  });

  it("hands the host role to the next player when the host leaves", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const hostChanged = waitFor<[string]>(guest, "room:host_changed");
    host.emit("room:leave");

    expect(await hostChanged).toEqual(["p2"]);
    expect(server.roomManager.getRoom(code)!.hostId).toBe("p2");
  });

  it("deletes the room once its last player leaves", async () => {
    const { host, code } = await createRoom(server);
    track(host);

    host.emit("room:leave");
    await waitForMaybe(host, "room:player_left", 300);

    expect(server.roomManager.getRoom(code)).toBeUndefined();
  });

  it("evicts a player from their old room when they create a new one", async () => {
    const { host, code: first } = await createRoom(server, { playerId: "p1" });
    track(host);
    const guest = track(await joinRoom(server, first, "p2"));

    const left = waitFor<[string]>(guest, "room:player_left");
    host.emit("room:create", "Alice again", "🦊", "p1");
    const [room] = await waitFor<[Room]>(host, "room:joined");

    expect(await left).toEqual(["p1"]);
    expect(room.code).not.toBe(first);
    // The old room must not keep a ghost that counts toward maxPlayers.
    expect(server.roomManager.getRoom(first)!.players.map((p) => p.id)).toEqual(["p2"]);
  });

  it("resets scores and status on 'play again'", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const room = server.roomManager.getRoom(code)!;
    room.players.forEach((p) => (p.score = 500));
    room.status = "finished";

    const seen = waitFor<[Room]>(guest, "room:play_again");
    host.emit("room:play_again");
    const [updated] = await seen;

    expect(updated.status).toBe("waiting");
    expect(updated.players.every((p) => p.score === 0)).toBe(true);
    expect(updated.players.every((p) => !p.isReady)).toBe(true);
  });

  it("only lets the host relaunch the game", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    guest.emit("room:play_again");
    const [message] = await waitFor<[string]>(guest, "room:error");
    expect(message).toBe("Seul l'hôte peut relancer la partie");
  });

  it("broadcasts chat messages to the whole room and caps their length", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const seen = waitFor<[{ message: string; playerName: string }]>(guest, "chat:message");
    host.emit("chat:send_message", "x".repeat(300));
    const [msg] = await seen;

    expect(msg.message).toHaveLength(200);
    expect(msg.playerName).toBe("Hôte");
  });

  it("drops empty chat messages", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));
    const messages = collect(guest, "chat:message");

    host.emit("chat:send_message", "   ");
    await waitForMaybe(guest, "chat:message", 300);

    expect(messages).toHaveLength(0);
  });
});
