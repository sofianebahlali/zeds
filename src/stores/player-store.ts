import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Player, Avatar } from "@/types";
import { generatePlayerId } from "@/lib/utils";

interface PlayerState {
  // Player data (persisted)
  playerId: string;
  playerName: string;
  avatar: Avatar | string;

  // Session data (not persisted)
  isHost: boolean;
  isReady: boolean;
  score: number;
  roundScore: number;

  // Actions
  setPlayerName: (name: string) => void;
  setAvatar: (avatar: Avatar | string) => void;
  setIsHost: (isHost: boolean) => void;
  setIsReady: (isReady: boolean) => void;
  updateScore: (points: number) => void;
  setRoundScore: (points: number) => void;
  resetSession: () => void;
  resetAll: () => void;
  getPlayer: () => Player;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Persisted data
      playerId: generatePlayerId(),
      playerName: "",
      avatar: "🦊",

      // Session data
      isHost: false,
      isReady: false,
      score: 0,
      roundScore: 0,

      // Actions
      setPlayerName: (name) => set({ playerName: name.trim() }),

      setAvatar: (avatar) => set({ avatar }),

      setIsHost: (isHost) => set({ isHost }),

      setIsReady: (isReady) => set({ isReady }),

      updateScore: (points) =>
        set((state) => ({ score: state.score + points })),

      setRoundScore: (points) => set({ roundScore: points }),

      resetSession: () =>
        set({
          isHost: false,
          isReady: false,
          score: 0,
          roundScore: 0,
        }),

      resetAll: () =>
        set({
          playerId: generatePlayerId(),
          playerName: "",
          avatar: "🦊",
          isHost: false,
          isReady: false,
          score: 0,
          roundScore: 0,
        }),

      getPlayer: () => {
        const state = get();
        return {
          id: state.playerId,
          name: state.playerName,
          avatar: state.avatar,
          isHost: state.isHost,
          isReady: state.isReady,
          isConnected: true,
          score: state.score,
          roundScore: state.roundScore,
        };
      },
    }),
    {
      name: "quizz-arena-player",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        playerId: state.playerId,
        playerName: state.playerName,
        avatar: state.avatar,
      }),
    }
  )
);
