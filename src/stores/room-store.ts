import { create } from "zustand";
import type { Room, Player, GameSettings, GameMode, RoomStatus, DEFAULT_GAME_SETTINGS } from "@/types";

interface RoomState {
  // Room data
  room: Room | null;
  players: Player[];

  // Actions
  setRoom: (room: Room | null) => void;
  updateRoomStatus: (status: RoomStatus) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  setPlayerReady: (playerId: string, isReady: boolean) => void;
  setPlayerDisconnected: (playerId: string, isConnected: boolean) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  setGameMode: (mode: GameMode) => void;
  setHost: (hostId: string) => void;
  incrementRound: () => void;
  resetRoom: () => void;

  // Computed
  getPlayer: (playerId: string) => Player | undefined;
  getHost: () => Player | undefined;
  isAllReady: () => boolean;
  getReadyCount: () => number;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  players: [],

  setRoom: (room) =>
    set({
      room,
      players: room?.players || [],
    }),

  updateRoomStatus: (status) =>
    set((state) => ({
      room: state.room ? { ...state.room, status } : null,
    })),

  setPlayers: (players) => set({ players }),

  addPlayer: (player) =>
    set((state) => ({
      players: [...state.players, player],
      room: state.room
        ? { ...state.room, players: [...state.players, player] }
        : null,
    })),

  removePlayer: (playerId) =>
    set((state) => {
      const newPlayers = state.players.filter((p) => p.id !== playerId);
      return {
        players: newPlayers,
        room: state.room ? { ...state.room, players: newPlayers } : null,
      };
    }),

  updatePlayer: (playerId, updates) =>
    set((state) => {
      const newPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, ...updates } : p
      );
      return {
        players: newPlayers,
        room: state.room ? { ...state.room, players: newPlayers } : null,
      };
    }),

  setPlayerReady: (playerId, isReady) =>
    set((state) => {
      const newPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, isReady } : p
      );
      return {
        players: newPlayers,
        room: state.room ? { ...state.room, players: newPlayers } : null,
      };
    }),

  setPlayerDisconnected: (playerId, isConnected) =>
    set((state) => {
      const newPlayers = state.players.map((p) =>
        p.id === playerId ? { ...p, isConnected } : p
      );
      return {
        players: newPlayers,
        room: state.room ? { ...state.room, players: newPlayers } : null,
      };
    }),

  updateSettings: (settings) =>
    set((state) => ({
      room: state.room
        ? { ...state.room, settings: { ...state.room.settings, ...settings } }
        : null,
    })),

  setGameMode: (mode) =>
    set((state) => ({
      room: state.room ? { ...state.room, gameMode: mode } : null,
    })),

  setHost: (hostId) =>
    set((state) => {
      const newPlayers = state.players.map((p) => ({
        ...p,
        isHost: p.id === hostId,
      }));
      return {
        players: newPlayers,
        room: state.room
          ? { ...state.room, hostId, players: newPlayers }
          : null,
      };
    }),

  incrementRound: () =>
    set((state) => ({
      room: state.room
        ? { ...state.room, currentRound: state.room.currentRound + 1 }
        : null,
    })),

  resetRoom: () => set({ room: null, players: [] }),

  // Computed getters
  getPlayer: (playerId) => get().players.find((p) => p.id === playerId),

  getHost: () => get().players.find((p) => p.isHost),

  isAllReady: () => {
    const { players } = get();
    if (players.length < 2) return false;
    return players.every((p) => p.isReady || p.isHost);
  },

  getReadyCount: () => get().players.filter((p) => p.isReady).length,
}));
