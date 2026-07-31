import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RoomManager } from "../../server/room-manager";
import type { Player } from "../../src/types";

const makePlayer = (id: string, name = id): Player => ({
  id,
  name,
  avatar: "🦊",
  isHost: false,
  isReady: false,
  isConnected: true,
  score: 0,
  roundScore: 0,
  loseStreak: 0,
});

describe("RoomManager", () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("creating and joining", () => {
    it("issues unambiguous 4-character codes", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 200; i++) {
        codes.add(rm.createRoom(makePlayer(`p${i}`)).code);
      }
      expect(codes.size).toBe(200);
      for (const code of codes) {
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
        // I/O/0/1 are excluded so codes can be read out loud.
        expect(code).not.toMatch(/[IO01]/);
      }
    });

    it("makes the creator the host", () => {
      const room = rm.createRoom(makePlayer("p1"));
      expect(room.hostId).toBe("p1");
      expect(room.players[0].isHost).toBe(true);
      expect(room.status).toBe("waiting");
      expect(room.settings.fastMode).toBe(true);
    });

    it("is case-insensitive about codes", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      expect(rm.getRoom(code.toLowerCase())?.code).toBe(code);
      expect(rm.joinRoom(code.toLowerCase(), makePlayer("p2"))).not.toBeNull();
    });

    it("returns null for an unknown code", () => {
      expect(rm.joinRoom("ZZZZ", makePlayer("p2"))).toBeNull();
      expect(rm.getRoom("ZZZZ")).toBeUndefined();
    });

    it("refuses to overfill a room", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.updateSettings(code, { maxPlayers: 2 });
      rm.joinRoom(code, makePlayer("p2"));

      expect(() => rm.joinRoom(code, makePlayer("p3"))).toThrow("La room est pleine");
    });

    it("refuses a newcomer once the game has started", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.updateRoomStatus(code, "playing");

      expect(() => rm.joinRoom(code, makePlayer("p2"))).toThrow("La partie a déjà commencé");
    });

    it("treats a re-join by an existing player as a reconnection, even mid-game", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));
      rm.mapSocketToPlayer("s2", "p2");
      rm.disconnectPlayer("s2");
      rm.updateRoomStatus(code, "playing");

      const room = rm.joinRoom(code, makePlayer("p2"));
      expect(room).not.toBeNull();
      expect(room!.players).toHaveLength(2);
      expect(room!.players.find((p) => p.id === "p2")!.isConnected).toBe(true);
    });

    it("does not reset an existing player's score when they re-join", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));
      rm.updatePlayerScore("p2", 250);

      rm.joinRoom(code, makePlayer("p2"));
      expect(rm.getRoom(code)!.players.find((p) => p.id === "p2")!.score).toBe(250);
    });
  });

  describe("leaving", () => {
    it("promotes the next player when the host leaves", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));

      const result = rm.leaveRoom("p1")!;
      expect(result.wasHost).toBe(true);
      expect(result.newHostId).toBe("p2");
      expect(rm.getRoom(code)!.hostId).toBe("p2");
    });

    it("does not reassign the host when a guest leaves", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));

      const result = rm.leaveRoom("p2")!;
      expect(result.wasHost).toBe(false);
      expect(result.newHostId).toBeUndefined();
      expect(rm.getRoom(code)!.hostId).toBe("p1");
    });

    it("deletes the room when the last player leaves", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.leaveRoom("p1");
      expect(rm.getRoom(code)).toBeUndefined();
      expect(rm.getRoomCount()).toBe(0);
    });

    it("forgets the leaver's sockets so they cannot keep issuing commands", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));
      rm.mapSocketToPlayer("s2", "p2");

      rm.leaveRoom("p2");
      expect(rm.getPlayerIdFromSocket("s2")).toBeUndefined();
      expect(rm.getSocketIdFromPlayerId("p2")).toBeUndefined();
    });

    it("returns null for a player who is not in any room", () => {
      expect(rm.leaveRoom("nobody")).toBeNull();
    });
  });

  describe("socket ↔ player mapping", () => {
    it("keeps exactly one socket per player", () => {
      rm.mapSocketToPlayer("s1", "p1");
      rm.mapSocketToPlayer("s2", "p1");

      expect(rm.getPlayerIdFromSocket("s1")).toBeUndefined();
      expect(rm.getPlayerIdFromSocket("s2")).toBe("p1");
      expect(rm.getSocketIdFromPlayerId("p1")).toBe("s2");
    });

    it("resolves in both directions", () => {
      rm.mapSocketToPlayer("s1", "p1");
      expect(rm.getPlayerIdFromSocket("s1")).toBe("p1");
      expect(rm.getSocketIdFromPlayerId("p1")).toBe("s1");
    });

    it("drops the mapping when a socket disconnects", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.mapSocketToPlayer("s1", "p1");

      const result = rm.disconnectPlayer("s1");
      expect(result!.room.code).toBe(code);
      expect(result!.player.isConnected).toBe(false);
      expect(rm.getPlayerIdFromSocket("s1")).toBeUndefined();
    });

    it("ignores a disconnect from an unknown socket", () => {
      expect(rm.disconnectPlayer("nope")).toBeNull();
    });

    it("cleans up the old socket when a player reconnects", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.mapSocketToPlayer("s1", "p1");

      const result = rm.reconnectPlayer(code, "p1", "s2");
      expect(result!.player.isConnected).toBe(true);
      expect(rm.getPlayerIdFromSocket("s1")).toBeUndefined();
      expect(rm.getSocketIdFromPlayerId("p1")).toBe("s2");
    });

    it("refuses to reconnect into a room that is gone or was never joined", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      expect(rm.reconnectPlayer("ZZZZ", "p1", "s1")).toBeNull();
      expect(rm.reconnectPlayer(code, "stranger", "s1")).toBeNull();
    });
  });

  describe("the disconnect grace period", () => {
    it("removes a timed-out player when others remain", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));

      const result = rm.removeTimedOutPlayer("p2");
      expect(result).not.toBeNull();
      expect(rm.getRoom(code)!.players.map((p) => p.id)).toEqual(["p1"]);
    });

    it("never removes the last player — that would delete the room under them", () => {
      const { code } = rm.createRoom(makePlayer("p1"));

      expect(rm.removeTimedOutPlayer("p1")).toBeNull();
      expect(rm.getRoom(code)).toBeDefined();
      expect(rm.getRoom(code)!.players).toHaveLength(1);
    });
  });

  describe("kicking", () => {
    it("lets the host remove someone", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));
      rm.mapSocketToPlayer("s2", "p2");

      expect(rm.kickPlayer(code, "p2", "p1")).toBe(true);
      expect(rm.getRoom(code)!.players.map((p) => p.id)).toEqual(["p1"]);
      expect(rm.getSocketIdFromPlayerId("p2")).toBeUndefined();
    });

    it("refuses a kick from a non-host, a self-kick, or an unknown target", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));
      rm.joinRoom(code, makePlayer("p3"));

      expect(rm.kickPlayer(code, "p3", "p2")).toBe(false);
      expect(rm.kickPlayer(code, "p1", "p1")).toBe(false);
      expect(rm.kickPlayer(code, "ghost", "p1")).toBe(false);
      expect(rm.getRoom(code)!.players).toHaveLength(3);
    });
  });

  describe("settings and scores", () => {
    it("recomputes totalRounds from the playlist", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      const room = rm.updateSettings(code, {
        playlist: [
          { mode: "open", rounds: 4 },
          { mode: "estimation", rounds: 3 },
        ],
      })!;

      expect(room.settings.totalRounds).toBe(7);
      expect(room.totalRounds).toBe(7);
    });

    it("merges partial settings without dropping the rest", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      const before = rm.getRoom(code)!.settings.maxPlayers;

      const room = rm.updateSettings(code, { roundDuration: 45 })!;
      expect(room.settings.roundDuration).toBe(45);
      expect(room.settings.maxPlayers).toBe(before);
    });

    it("accumulates the running total and tracks the round score", () => {
      const { code } = rm.createRoom(makePlayer("p1"));

      expect(rm.updatePlayerScore("p1", 100)!.score).toBe(100);
      const player = rm.updatePlayerScore("p1", 50)!;
      expect(player.score).toBe(150);
      expect(player.roundScore).toBe(50);

      rm.resetRoundScores(code);
      expect(rm.getRoom(code)!.players[0].roundScore).toBe(0);
      expect(rm.getRoom(code)!.players[0].score).toBe(150);
    });

    it("wipes everything for a new game", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.updatePlayerScore("p1", 100);
      rm.getRoom(code)!.players[0].loseStreak = 3;
      rm.getRoom(code)!.currentRound = 5;

      rm.resetAllScores(code);
      const room = rm.getRoom(code)!;
      expect(room.players[0]).toMatchObject({ score: 0, roundScore: 0, loseStreak: 0 });
      expect(room.currentRound).toBe(0);
    });

    it("sorts the leaderboard by score, highest first", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(code, makePlayer("p2"));
      rm.joinRoom(code, makePlayer("p3"));
      rm.updatePlayerScore("p1", 50);
      rm.updatePlayerScore("p2", 300);
      rm.updatePlayerScore("p3", 150);

      expect(rm.getLeaderboard(code).map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    });
  });

  describe("readiness", () => {
    it("counts the host as always ready", () => {
      const { code } = rm.createRoom(makePlayer("p1"));
      expect(rm.areAllPlayersReady(code)).toBe(true);

      rm.joinRoom(code, makePlayer("p2"));
      expect(rm.areAllPlayersReady(code)).toBe(false);

      rm.setPlayerReady("p2", true);
      expect(rm.areAllPlayersReady(code)).toBe(true);
    });

    it("says no for a room that does not exist", () => {
      expect(rm.areAllPlayersReady("ZZZZ")).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("keeps a room that still has someone connected", () => {
      rm.createRoom(makePlayer("p1"));
      expect(rm.cleanupInactiveRooms()).toEqual([]);
      expect(rm.getRoomCount()).toBe(1);
    });

    it("reaps a room once it has been abandoned long enough", () => {
      vi.useFakeTimers();
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.mapSocketToPlayer("s1", "p1");
      rm.disconnectPlayer("s1");

      // The abandonment clock starts on the disconnect; 15 minutes is the TTL.
      vi.advanceTimersByTime(16 * 60 * 1000);
      const removed = rm.cleanupInactiveRooms();

      expect(removed).toEqual([{ code, playerIds: ["p1"] }]);
      expect(rm.getRoom(code)).toBeUndefined();
      expect(rm.getRoomByPlayerId("p1")).toBeUndefined();
    });

    it("reaps a room that has been sitting in the lobby for over an hour", () => {
      vi.useFakeTimers();
      const { code } = rm.createRoom(makePlayer("p1"));
      vi.advanceTimersByTime(61 * 60 * 1000);

      expect(rm.cleanupInactiveRooms().map((r) => r.code)).toEqual([code]);
    });

    it("spares an abandoned room until the TTL is up", () => {
      vi.useFakeTimers();
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.mapSocketToPlayer("s1", "p1");
      rm.disconnectPlayer("s1");

      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(rm.cleanupInactiveRooms()).toEqual([]);
      expect(rm.getRoom(code)).toBeDefined();
    });

    it("stops the clock as soon as somebody comes back", () => {
      vi.useFakeTimers();
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.mapSocketToPlayer("s1", "p1");
      rm.disconnectPlayer("s1");

      vi.advanceTimersByTime(10 * 60 * 1000);
      rm.reconnectPlayer(code, "p1", "s2");
      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(rm.cleanupInactiveRooms()).toEqual([]);
      expect(rm.getRoom(code)).toBeDefined();
    });

    it("reaps a room stuck mid-game, not just lobbies", () => {
      vi.useFakeTimers();
      const { code } = rm.createRoom(makePlayer("p1"));
      rm.updateRoomStatus(code, "playing");
      rm.mapSocketToPlayer("s1", "p1");
      rm.disconnectPlayer("s1");

      vi.advanceTimersByTime(16 * 60 * 1000);
      expect(rm.cleanupInactiveRooms().map((r) => r.code)).toEqual([code]);
    });
  });

  describe("counters", () => {
    it("reports rooms and players across the whole server", () => {
      const a = rm.createRoom(makePlayer("p1"));
      rm.joinRoom(a.code, makePlayer("p2"));
      rm.createRoom(makePlayer("p3"));

      expect(rm.getRoomCount()).toBe(2);
      expect(rm.getTotalPlayerCount()).toBe(3);
    });
  });
});
