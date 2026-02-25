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
};

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomCode
  private socketPlayers: Map<string, string> = new Map(); // socketId -> playerId

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
      gameMode: "qcm",
      settings: { ...DEFAULT_SETTINGS },
      currentRound: 0,
      totalRounds: DEFAULT_SETTINGS.totalRounds,
      createdAt: Date.now(),
    };

    this.rooms.set(code, room);
    this.playerRooms.set(player.id, code);

    console.log(`Room ${code} created by ${player.name}`);
    return room;
  }

  /**
   * Join an existing room
   */
  joinRoom(code: string, player: Player): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      return null;
    }

    // Check if room is full
    if (room.players.length >= room.settings.maxPlayers) {
      throw new Error("Room is full");
    }

    // Check if game already started
    if (room.status !== "waiting") {
      throw new Error("Game already in progress");
    }

    // Check if player already in room (reconnection)
    const existingPlayer = room.players.find((p) => p.id === player.id);
    if (existingPlayer) {
      existingPlayer.isConnected = true;
      this.playerRooms.set(player.id, code);
      return room;
    }

    // Add new player
    const newPlayer: Player = {
      ...player,
      isHost: false,
      isReady: false,
      isConnected: true,
      score: 0,
      roundScore: 0,
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

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
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

    console.log(`${player.name} disconnected from room ${roomCode}`);
    return { room, player };
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
    this.playerRooms.set(playerId, roomCode);
    this.socketPlayers.set(socketId, playerId);

    console.log(`${player.name} reconnected to room ${roomCode}`);
    return { room, player };
  }

  /**
   * Map socket ID to player ID
   */
  mapSocketToPlayer(socketId: string, playerId: string): void {
    this.socketPlayers.set(socketId, playerId);
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
   * Cleanup inactive rooms (older than 1 hour)
   */
  cleanupInactiveRooms(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    for (const [code, room] of this.rooms.entries()) {
      if (room.createdAt < oneHourAgo && room.status === "waiting") {
        // Remove all player mappings
        room.players.forEach((p) => {
          this.playerRooms.delete(p.id);
        });
        this.rooms.delete(code);
        console.log(`Room ${code} cleaned up (inactive)`);
      }
    }
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
