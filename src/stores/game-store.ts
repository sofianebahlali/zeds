import { create } from "zustand";
import type { Question, Answer, RoundResult, GameState, VotingPhaseData, VotingResults } from "@/types";

type GameStatus = "idle" | "countdown" | "question" | "answering" | "voting" | "revealing" | "leaderboard" | "finished";

interface GameStoreState {
  // Game state
  status: GameStatus;
  currentRound: number;
  totalRounds: number;
  currentQuestion: Question | null;
  timeRemaining: number;
  countdown: number;

  // Answers and results
  myAnswer: string | null;
  hasAnswered: boolean;
  answeredPlayers: string[];
  roundResult: RoundResult | null;
  allResults: RoundResult[];

  // Voting state
  votingData: VotingPhaseData | null;
  votingTimeRemaining: number;
  myVotes: Record<string, boolean>; // targetPlayerId -> isValid
  votedPlayers: Record<string, string[]>; // targetPlayerId -> voterIds who voted
  votingResults: VotingResults | null;

  // Actions
  setStatus: (status: GameStatus) => void;
  setCurrentQuestion: (question: Question) => void;
  setTimeRemaining: (time: number) => void;
  decrementTime: () => void;
  setCountdown: (countdown: number) => void;
  decrementCountdown: () => void;
  submitAnswer: (answer: string) => void;
  markPlayerAnswered: (playerId: string) => void;
  setRoundResult: (result: RoundResult) => void;
  nextRound: () => void;
  resetGame: () => void;
  startGame: (totalRounds: number) => void;
  finishGame: () => void;

  // Voting actions
  startVoting: (data: VotingPhaseData) => void;
  setVotingTimeRemaining: (time: number) => void;
  recordMyVote: (targetPlayerId: string, isValid: boolean) => void;
  markPlayerVoted: (voterId: string, targetPlayerId: string) => void;
  setVotingResults: (results: VotingResults) => void;
  endVoting: () => void;

  // Computed
  getProgress: () => number;
  canSubmitAnswer: () => boolean;
  hasVotedFor: (targetPlayerId: string) => boolean;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  // Initial state
  status: "idle",
  currentRound: 0,
  totalRounds: 10,
  currentQuestion: null,
  timeRemaining: 0,
  countdown: 0,
  myAnswer: null,
  hasAnswered: false,
  answeredPlayers: [],
  roundResult: null,
  allResults: [],

  // Voting initial state
  votingData: null,
  votingTimeRemaining: 0,
  myVotes: {},
  votedPlayers: {},
  votingResults: null,

  // Actions
  setStatus: (status) => set({ status }),

  setCurrentQuestion: (question) =>
    set({
      currentQuestion: question,
      timeRemaining: question.timeLimit,
      myAnswer: null,
      hasAnswered: false,
      answeredPlayers: [],
      status: "question",
    }),

  setTimeRemaining: (time) => set({ timeRemaining: time }),

  decrementTime: () =>
    set((state) => ({
      timeRemaining: Math.max(0, state.timeRemaining - 1),
    })),

  setCountdown: (countdown) => set({ countdown, status: "countdown" }),

  decrementCountdown: () =>
    set((state) => ({
      countdown: Math.max(0, state.countdown - 1),
    })),

  submitAnswer: (answer) =>
    set({
      myAnswer: answer,
      hasAnswered: true,
      status: "answering",
    }),

  markPlayerAnswered: (playerId) =>
    set((state) => ({
      answeredPlayers: state.answeredPlayers.includes(playerId)
        ? state.answeredPlayers
        : [...state.answeredPlayers, playerId],
    })),

  setRoundResult: (result) =>
    set((state) => ({
      roundResult: result,
      allResults: [...state.allResults, result],
      status: "revealing",
    })),

  nextRound: () =>
    set((state) => ({
      currentRound: state.currentRound + 1,
      currentQuestion: null,
      myAnswer: null,
      hasAnswered: false,
      answeredPlayers: [],
      roundResult: null,
      status: "idle",
    })),

  startGame: (totalRounds) =>
    set({
      status: "countdown",
      currentRound: 1,
      totalRounds,
      currentQuestion: null,
      timeRemaining: 0,
      countdown: 3,
      myAnswer: null,
      hasAnswered: false,
      answeredPlayers: [],
      roundResult: null,
      allResults: [],
    }),

  finishGame: () => set({ status: "finished" }),

  // Voting actions
  startVoting: (data) =>
    set({
      status: "voting",
      votingData: data,
      votingTimeRemaining: data.timeRemaining,
      myVotes: {},
      votedPlayers: {},
      votingResults: null,
    }),

  setVotingTimeRemaining: (time) => set({ votingTimeRemaining: time }),

  recordMyVote: (targetPlayerId, isValid) =>
    set((state) => ({
      myVotes: { ...state.myVotes, [targetPlayerId]: isValid },
    })),

  markPlayerVoted: (voterId, targetPlayerId) =>
    set((state) => {
      const currentVoters = state.votedPlayers[targetPlayerId] || [];
      if (currentVoters.includes(voterId)) return state;
      return {
        votedPlayers: {
          ...state.votedPlayers,
          [targetPlayerId]: [...currentVoters, voterId],
        },
      };
    }),

  setVotingResults: (results) => set({ votingResults: results }),

  endVoting: () =>
    set({
      votingData: null,
      votingTimeRemaining: 0,
    }),

  resetGame: () =>
    set({
      status: "idle",
      currentRound: 0,
      totalRounds: 10,
      currentQuestion: null,
      timeRemaining: 0,
      countdown: 0,
      myAnswer: null,
      hasAnswered: false,
      answeredPlayers: [],
      roundResult: null,
      allResults: [],
      // Reset voting state
      votingData: null,
      votingTimeRemaining: 0,
      myVotes: {},
      votedPlayers: {},
      votingResults: null,
    }),

  // Computed
  getProgress: () => {
    const { currentRound, totalRounds } = get();
    return (currentRound / totalRounds) * 100;
  },

  canSubmitAnswer: () => {
    const { status, hasAnswered, timeRemaining } = get();
    return status === "question" && !hasAnswered && timeRemaining > 0;
  },

  hasVotedFor: (targetPlayerId) => {
    const { myVotes } = get();
    return targetPlayerId in myVotes;
  },
}));
