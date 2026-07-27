import type { Room, Player, GameSettings, GameMode, GameModeConfig, RoomStatus } from "../src/types";
import { DEFAULT_PLAYLIST } from "../src/types";

function computeTotalRounds(playlist: GameModeConfig[]): number {
  return playlist.reduce((sum, seg) => sum + seg.rounds, 0);
}

const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 8,
  roundDuration: 30,
  totalRounds: computeTotalRounds(DEFAULT_PLAYLIST),
  showLeaderboardBetweenRounds: true,
  difficulty: "medium",
  playlist: [...DEFAULT_PLAYLIST],
  teamRoundsEnabled: false,
  hideScoresBetweenRounds: false,
  shufflePlaylist: false,
};

/**
 * How long a room may stay fully abandoned (zero connected players) before it
 * is reaped. Generous on purpose: a mobile player who takes a phone call must
 * still find their room when they come back.
 */
const ABANDONED_ROOM_TTL_MS = 15 * 60 * 1000;

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomCode
  private socketPlayers: Map<string, string> = new Map(); // socketId -> playerId
  // roomCode -> timestamp at which the room lost its last connected player.
  // Cleared as soon as anybody reconnects.
  private abandonedSince: Map<string, number> = new Map();

  /**
   * Generate a unique room code
   */
  private generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code: string;
    do {
      code = "";
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Create a new room
   */
  createRoom(player: Player): Room {
    const code = this.generateRoomCode();
    const room: Room = {
      code,
      hostId: player.id,
      players: [{ ...player, isHost: true, isReady: false }],
      status: "waiting",
      gameMode: "open",
      settings: { ...DEFAULT_SETTINGS },
      currentRound: 0,
      totalRounds: DEFAULT_SETTINGS.totalRounds,
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    this.playerRooms.set(player.id, code);
    this.abandonedSince.delete(code);

    console.log(`Room ${code} created by ${player.name}`);
    return room;
  }

  /**
   * Room this player is currently registered in, if any. Used to evict a
   * player from a stale room before they create or join another one —
   * otherwise the old room keeps a ghost player that counts toward maxPlayers
   * and blocks its "everyone ready" check forever.
   */
  getCurrentRoomCode(playerId: string): string | undefined {
    return this.playerRooms.get(playerId);
  }

  /**
   * Join an existing room
   */
  joinRoom(code: string, player: Player): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      return null;
    }

    // Player already in the room → treat as a reconnection. Checked *before*
    // the "full" / "already started" guards so that someone who dropped out
    // mid-game can always get back in via the join screen.
    const existingPlayer = room.players.find((p) => p.id === player.id);
    if (existingPlayer) {
      existingPlayer.isConnected = true;
      this.playerRooms.set(player.id, code);
      this.abandonedSince.delete(room.code);
      return room;
    }

    // Check if room is full
    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error("La room est pleine");
    }

    // Check if game already started
    if (room.status !== "waiting") {
      throw new Error("La partie a déjà commencé");
    }

    // Add new player
    const newPlayer: Player = {
      ...player,
      isHost: false,
      isReady: false,
      isConnected: true,
      score: 0,
      roundScore: 0,
      loseStreak: 0,
    };

    room.players.push(newPlayer);
    this.playerRooms.set(player.id, code);

    console.log(`${player.name} joined room ${code}`);
    return room;
  }

  /**
   * Leave a room
   */
  leaveRoom(playerId: string): { room: Room; wasHost: boolean; newHostId?: string } | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;

    const wasHost = player.isHost;

    // Remove player from room
    room.players = room.players.filter((p) => p.id !== playerId);
    this.playerRooms.delete(playerId);
    this.unmapPlayerSockets(playerId);

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      this.abandonedSince.delete(roomCode);
      console.log(`Room ${roomCode} deleted (empty)`);
      return { room, wasHost };
    }

    // If host left, assign new host
    let newHostId: string | undefined;
    if (wasHost && room.players.length > 0) {
      const newHost = room.players[0];
      newHost.isHost = true;
      room.hostId = newHost.id;
      newHostId = newHost.id;
      console.log(`New host for room ${roomCode}: ${newHost.name}`);
    }

    console.log(`${player.name} left room ${roomCode}`);
    return { room, wasHost, newHostId };
  }

  /**
   * Mark player as disconnected (but don't remove yet)
   */
  disconnectPlayer(socketId: string): { room: Room; player: Player } | null {
    const playerId = this.socketPlayers.get(socketId);
    if (!playerId) return null;

    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;

    player.isConnected = false;
    this.socketPlayers.delete(socketId);

    // Start the abandonment clock once nobody is left connected
    if (!room.players.some((p) => p.isConnected) && !this.abandonedSince.has(roomCode)) {
      this.abandonedSince.set(roomCode, Date.now());
    }

    console.log(`${player.name} disconnected from room ${roomCode}`);
    return { room, player };
  }

  /**
   * Remove a player who never came back after the disconnect grace period.
   *
   * Never removes the last player standing: an empty room gets deleted, and
   * deleting the room of a player who is merely backgrounded on mobile is what
   * makes a room "die" under them. Abandoned rooms are reaped by
   * cleanupInactiveRooms() instead, on a much longer clock.
   */
  removeTimedOutPlayer(
    playerId: string
  ): { room: Room; wasHost: boolean; newHostId?: string } | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    if (room.players.length <= 1) return null;

    return this.leaveRoom(playerId);
  }

  /**
   * Reconnect a player
   */
  reconnectPlayer(
    roomCode: string,
    playerId: string,
    socketId: string
  ): { room: Room; player: Player } | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return null;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;

    player.isConnected = true;
    this.playerRooms.set(playerId, room.code);
    this.abandonedSince.delete(room.code);

    // Also clears any stale socket entry for this player (race condition: the
    // new socket may connect before the old one's disconnect event fires).
    this.mapSocketToPlayer(socketId, playerId);

    console.log(`${player.name} reconnected to room ${roomCode}`);
    return { room, player };
  }

  /**
   * Map socket ID to player ID.
   *
   * A player owns exactly one socket: any earlier entry is dropped first,
   * otherwise getSocketIdFromPlayerId() can hand out a dead socket and the
   * per-player emits (hints, guess results, drawing prompts) go nowhere.
   */
  mapSocketToPlayer(socketId: string, playerId: string): void {
    for (const [oldSocketId, pId] of this.socketPlayers) {
      if (pId === playerId && oldSocketId !== socketId) {
        this.socketPlayers.delete(oldSocketId);
      }
    }
    this.socketPlayers.set(socketId, playerId);
  }

  /**
   * Forget every socket bound to this player. Called when the player really
   * leaves (quit, kicked, reaped) so their old sockets can't keep issuing
   * commands on a room they are no longer in.
   */
  unmapPlayerSockets(playerId: string): void {
    for (const [socketId, pId] of this.socketPlayers) {
      if (pId === playerId) {
        this.socketPlayers.delete(socketId);
      }
    }
  }

  /**
   * Get player ID from socket ID
   */
  getPlayerIdFromSocket(socketId: string): string | undefined {
    return this.socketPlayers.get(socketId);
  }

  /**
   * Get socket ID from player ID (reverse lookup)
   */
  getSocketIdFromPlayerId(playerId: string): string | undefined {
    for (const [socketId, pId] of this.socketPlayers) {
      if (pId === playerId) return socketId;
    }
    return undefined;
  }

  /**
   * Get room by code
   */
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /**
   * Get room by player ID
   */
  getRoomByPlayerId(playerId: string): Room | undefined {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return undefined;
    return this.rooms.get(roomCode);
  }

  /**
   * Update room settings
   */
  updateSettings(code: string, settings: Partial<GameSettings>): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.settings = { ...room.settings, ...settings };

    // Recompute totalRounds from playlist
    if (room.settings.playlist) {
      room.settings.totalRounds = computeTotalRounds(room.settings.playlist);
    }
    room.totalRounds = room.settings.totalRounds;
    return room;
  }

  /**
   * Update game mode
   */
  updateGameMode(code: string, mode: GameMode): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.gameMode = mode;
    return room;
  }

  /**
   * Update room status
   */
  updateRoomStatus(code: string, status: RoomStatus): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.status = status;
    return room;
  }

  /**
   * Set player ready status
   */
  setPlayerReady(playerId: string, isReady: boolean): { room: Room; player: Player } | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;

    player.isReady = isReady;
    return { room, player };
  }

  /**
   * Update player score
   */
  updatePlayerScore(playerId: string, points: number): Player | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.find((p) => p.id === playerId);
    if (!player) return null;

    player.roundScore = points;
    player.score += points;
    return player;
  }

  /**
   * Reset player round scores
   */
  resetRoundScores(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    room.players.forEach((p) => {
      p.roundScore = 0;
    });
  }

  /**
   * Reset all player scores (for play again)
   */
  resetAllScores(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    room.players.forEach((p) => {
      p.score = 0;
      p.roundScore = 0;
      p.loseStreak = 0;
    });
    room.currentRound = 0;
  }

  /**
   * Kick a player from room
   */
  kickPlayer(code: string, playerId: string, requesterId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;

    // Only host can kick
    if (room.hostId !== requesterId) return false;

    // Can't kick yourself
    if (playerId === requesterId) return false;

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return false;

    room.players.splice(playerIndex, 1);
    this.playerRooms.delete(playerId);
    this.unmapPlayerSockets(playerId);
    return true;
  }

  /**
   * Check if all players are ready
   */
  areAllPlayersReady(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.players.length < 1) return false;

    return room.players.every((p) => p.isReady || p.isHost);
  }

  /**
   * Get sorted leaderboard
   */
  getLeaderboard(code: string): Player[] {
    const room = this.rooms.get(code);
    if (!room) return [];

    return [...room.players].sort((a, b) => b.score - a.score);
  }

  /**
   * Cleanup inactive rooms. Returns the codes that were removed so the caller
   * can tear down the matching game engines (their timers would otherwise run
   * forever).
   *
   * Two rules:
   *  - abandoned: nobody connected for ABANDONED_ROOM_TTL_MS, whatever the
   *    room status (a room stuck in "playing" used to leak forever)
   *  - stale: still in the lobby more than an hour after creation
   */
  cleanupInactiveRooms(): { code: string; playerIds: string[] }[] {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const removed: { code: string; playerIds: string[] }[] = [];

    for (const [code, room] of this.rooms.entries()) {
      const abandonedAt = this.abandonedSince.get(code);
      const hasConnectedPlayer = room.players.some((p) => p.isConnected);

      // Self-heal the bookkeeping if it drifted
      if (hasConnectedPlayer && abandonedAt !== undefined) {
        this.abandonedSince.delete(code);
        continue;
      }
      if (!hasConnectedPlayer && abandonedAt === undefined) {
        this.abandonedSince.set(code, now);
        continue;
      }

      const isAbandoned = abandonedAt !== undefined && now - abandonedAt > ABANDONED_ROOM_TTL_MS;
      const isStale = room.createdAt < oneHourAgo && room.status === "waiting";
      if (!isAbandoned && !isStale) continue;

      // Remove all player and socket mappings
      const playerIds = room.players.map((p) => p.id);
      playerIds.forEach((playerId) => {
        this.playerRooms.delete(playerId);
        this.unmapPlayerSockets(playerId);
      });
      this.rooms.delete(code);
      this.abandonedSince.delete(code);
      removed.push({ code, playerIds });
      console.log(`Room ${code} cleaned up (${isAbandoned ? "abandoned" : "stale"})`);
    }

    return removed;
  }

  /**
   * Get room count
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Get total player count
   */
  getTotalPlayerCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.players.length;
    }
    return count;
  }
}
