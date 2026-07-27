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
  sleep,
  type TestServer,
  type TestClient,
} from "../helpers/test-server";
import { getGameEngine } from "../../server/socket-handlers";
import type { GameResyncData, Player, Question, ReconnectFailureReason, Room } from "../../src/types";

/**
 * Everything that happens when a phone is backgrounded, a page is reloaded, or
 * the same player opens a second tab.
 */
describe("reconnection", () => {
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

  async function startGame(host: TestClient) {
    host.emit("game:start");
    return waitFor<[number, Question]>(host, "game:round_start", 12_000);
  }

  // ==========================================
  // Handshake re-attachment
  // ==========================================

  it("re-attaches a returning socket straight from the handshake", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    guest.disconnect();
    await sleep(100);

    const back = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    const reconnected = waitFor<[Room, Player]>(back, "connection:reconnected");
    back.connect();

    const [room, player] = await reconnected;
    expect(room.code).toBe(code);
    expect(player.id).toBe("p2");
    expect(room.players.find((p) => p.id === "p2")!.isConnected).toBe(true);
  });

  it("tells the rest of the room when someone drops and comes back", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const dropped = waitFor<[string]>(host, "connection:player_disconnected");
    guest.disconnect();
    expect(await dropped).toEqual(["p2"]);

    const returned = waitFor<[string]>(host, "connection:player_reconnected");
    const back = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    back.connect();
    expect(await returned).toEqual(["p2"]);
  });

  it("accepts commands immediately after re-attaching, with no round trip", async () => {
    // The whole point of the handshake path: a client's buffered emits land
    // before it could ever have sent a connection:reconnect.
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));
    guest.disconnect();
    await sleep(100);

    const back = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    const readySeen = waitFor<[string, boolean]>(host, "room:player_ready");
    back.connect();
    back.emit("room:ready", true);

    expect(await readySeen).toEqual(["p2", true]);
  });

  it("reports a vanished room instead of leaving the client hanging", async () => {
    const ghost = track(createClient(server.url, { playerId: "p9", roomCode: "ZZZZ" }));
    const failed = waitFor<[ReconnectFailureReason]>(ghost, "connection:reconnect_failed");
    ghost.connect();

    expect(await failed).toEqual(["room_gone"]);
  });

  it("distinguishes a removed player from a vanished room", async () => {
    const { host, code } = await createRoom(server);
    track(host);

    const stranger = track(createClient(server.url, { playerId: "never-joined", roomCode: code }));
    const failed = waitFor<[ReconnectFailureReason]>(stranger, "connection:reconnect_failed");
    stranger.connect();

    expect(await failed).toEqual(["player_removed"]);
  });

  it("still supports the explicit connection:reconnect fallback", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));
    guest.disconnect();
    await sleep(100);

    // No roomCode in the handshake — the client has to ask.
    const back = track(createClient(server.url, { playerId: "p2" }));
    await connect(back);
    expect(await waitForMaybe(back, "connection:reconnected", 200)).toBeNull();

    back.emit("connection:reconnect", code, "p2");
    const [room] = await waitFor<[Room]>(back, "connection:reconnected");
    expect(room.code).toBe(code);
  });

  // ==========================================
  // Mid-game resync
  // ==========================================

  it("replays the round in flight to a player who missed the broadcast", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const [, question] = await startGame(host);
    await sleep(1100); // let the clock tick at least once

    guest.disconnect();
    await sleep(100);

    const back = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    const resync = waitFor<[GameResyncData]>(back, "game:resync");
    back.connect();

    const [data] = await resync;
    expect(data.round).toBe(1);
    expect(data.totalRounds).toBe(2);
    expect(data.question.id).toBe(question.id);
    expect(data.timeRemaining).toBeLessThan(question.timeLimit);
    expect(data.myAnswer).toBeNull();
    // Still sanitized — a resync must not become a back door to the answer.
    expect((data.question as { answers: string[] }).answers).toEqual([]);
  });

  it("reminds a returning player of the answer they already gave", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    await startGame(host);
    guest.emit("game:submit_answer", "ma réponse");
    await waitFor(host, "game:player_answered");

    guest.disconnect();
    await sleep(100);

    const back = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    const resync = waitFor<[GameResyncData]>(back, "game:resync");
    back.connect();

    const [data] = await resync;
    expect(data.myAnswer).toBe("ma réponse");
    expect(data.answeredPlayerIds).toContain("p2");
  });

  it("does not resync a player who reconnects while the room is still in the lobby", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));
    guest.disconnect();
    await sleep(100);

    const back = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    back.connect();
    await waitFor(back, "connection:reconnected");

    expect(await waitForMaybe(back, "game:resync", 300)).toBeNull();
  });

  // ==========================================
  // Empty room: pause instead of ending the game
  // ==========================================

  it("keeps a solo game alive across a disconnection and freezes its clock", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);

    await startGame(host);
    await sleep(1100);
    const beforeDrop = remainingTime(code);

    const finished = waitForMaybe(host, "game:finished", 200);
    host.disconnect();
    expect(await finished).toBeNull();

    await sleep(2500); // long enough for 2 ticks, had the clock kept running
    expect(remainingTime(code)).toBe(beforeDrop);
    expect(server.roomManager.getRoom(code)).toBeDefined();

    const back = track(createClient(server.url, { playerId: "host", roomCode: code }));
    const resync = waitFor<[GameResyncData]>(back, "game:resync");
    back.connect();

    const [data] = await resync;
    expect(data.timeRemaining).toBe(beforeDrop);

    // …and the clock is running again.
    const [tick] = await waitFor<[number]>(back, "game:time_update", 3000);
    expect(tick).toBe(beforeDrop - 1);
  });

  // Regression: the round used to end the moment answers.size reached the
  // number of *connected* players, so an answer from someone who then dropped
  // closed the round on a player who had not answered yet.
  it("does not end the round on behalf of a player who is still answering", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    await startGame(host);
    guest.emit("game:submit_answer", "réponse du fuyard");
    await waitFor(host, "game:player_answered");

    const endedEarly = waitForMaybe(host, "game:round_end", 1000);
    guest.disconnect();
    expect(await endedEarly).toBeNull();

    // The host still gets their turn, and their answer closes the round.
    const ended = waitFor(host, "game:round_end", 6000);
    host.emit("game:submit_answer", "ma réponse");
    await ended;
  });

  it("carries on scoring for the players who are still there", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    await startGame(host);

    // The guest vanishes; the host answering alone must be enough to end the round.
    const dropped = waitFor(host, "connection:player_disconnected");
    guest.disconnect();
    await dropped;

    const ended = waitFor<[{ scores: { playerId: string }[] }]>(host, "game:round_end", 6000);
    host.emit("game:submit_answer", "peu importe");
    const [result] = await ended;

    expect(result.scores.map((s) => s.playerId).sort()).toEqual(["host", "p2"]);
  });

  // ==========================================
  // One identity, one socket
  // ==========================================

  it("retires the older socket when the same player opens a second tab", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const tab1 = track(await joinRoom(server, code, "p2"));

    const superseded = waitFor(tab1, "connection:superseded");
    const tab2 = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    // Listener first: the server re-attaches straight from the handshake, so
    // connection:reconnected can land before connect() even returns.
    const tab2Reconnected = waitFor(tab2, "connection:reconnected");
    tab2.connect();

    await superseded;
    await tab2Reconnected;
    await sleep(100);

    expect(tab1.connected).toBe(false);
    expect(tab2.connected).toBe(true);
  });

  it("routes the room's commands to the surviving tab", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const tab1 = track(await joinRoom(server, code, "p2"));

    const tab2 = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    const tab2Reconnected = waitFor(tab2, "connection:reconnected");
    tab2.connect();
    await waitFor(tab1, "connection:superseded");
    await tab2Reconnected;

    const readySeen = waitFor<[string, boolean]>(host, "room:player_ready");
    tab2.emit("room:ready", true);
    expect(await readySeen).toEqual(["p2", true]);

    // And the room still holds exactly one player for that identity.
    expect(server.roomManager.getRoom(code)!.players.filter((p) => p.id === "p2")).toHaveLength(1);
  });

  it("leaves a lone reconnecting socket alone", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const superseded = collect(guest, "connection:superseded");
    guest.disconnect();
    await sleep(100);

    const back = track(createClient(server.url, { playerId: "p2", roomCode: code }));
    back.connect();
    await waitFor(back, "connection:reconnected");

    expect(superseded).toHaveLength(0);
  });

  // ==========================================
  // Kicking
  // ==========================================

  it("tells the kicked player, and only them", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));
    const other = track(await joinRoom(server, code, "p3"));

    const kicked = waitFor(guest, "room:kicked");
    const leftSeen = waitFor<[string]>(other, "room:player_left");
    const kickedAlsoGetsLeft = collect<[string]>(guest, "room:player_left");

    host.emit("room:kick_player", "p2");

    await kicked;
    expect(await leftSeen).toEqual(["p2"]);
    await sleep(100);

    // The kicked socket is out of the room, so it must not also be told
    // "p2 a quitté la partie" about itself.
    expect(kickedAlsoGetsLeft).toHaveLength(0);
    expect(server.roomManager.getRoom(code)!.players.map((p) => p.id)).toEqual(["host", "p3"]);
  });

  it("cuts a kicked player off from the room's events", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    host.emit("room:kick_player", "p2");
    await waitFor(guest, "room:kicked");

    const stillListening = collect(guest, "chat:message");
    host.emit("chat:send_message", "vous m'entendez ?");
    await sleep(200);

    expect(stillListening).toHaveLength(0);
  });

  it("only lets the host kick", async () => {
    const { host, code } = await createRoom(server);
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));
    const other = track(await joinRoom(server, code, "p3"));

    guest.emit("room:kick_player", "p3");
    expect(await waitForMaybe(other, "room:kicked", 300)).toBeNull();
    expect(server.roomManager.getRoom(code)!.players).toHaveLength(3);
  });

  // ==========================================
  // Re-joining through the join screen
  // ==========================================

  it("puts a player who re-joins a running game back on the game screen", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));
    await startGame(host);

    guest.disconnect();
    await sleep(100);

    const back = track(createClient(server.url, { playerId: "p2" }));
    await connect(back);
    back.emit("room:join", code, "p2", "🐼", "p2");

    // connection:reconnected (not room:joined) is what routes the client to the
    // game screen rather than the lobby.
    const [room] = await waitFor<[Room]>(back, "connection:reconnected");
    expect(room.status).toBe("playing");
    expect(await waitForMaybe(back, "room:joined", 200)).toBeNull();
  });

  it("refuses a brand-new player once the game has started", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);
    await startGame(host);

    const late = track(createClient(server.url, { playerId: "late" }));
    await connect(late);
    late.emit("room:join", code, "Late", "🐧", "late");

    const [message] = await waitFor<[string]>(late, "room:error");
    expect(message).toBe("La partie a déjà commencé");
  });
});

/** The engine's clock, to prove it stops and restarts. */
function remainingTime(code: string): number {
  const engine = getGameEngine(code);
  if (!engine) throw new Error(`no engine for room ${code}`);
  return (engine as unknown as { timeRemaining: number }).timeRemaining;
}
