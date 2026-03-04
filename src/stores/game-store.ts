import { create } from "zustand";
import type { Question, Answer, RoundResult, GameState, DrawingPhase, DrawingRevealState, DrawingRoundResult, PetitBacValidationData, PetitBacValidationSubmission, GeoQuizValidationData, GeoQuizValidationSubmission, GeoQuizAnswerResultData, LangueValidationData, LangueValidationSubmission, LangueAnswerResultData, GuessGameValidationData, GuessGameAnswerResultData, TeamRoundData, TeamRoundResult, LineupGuessResult, LineupMatch, GameMode } from "@/types";

type GameStatus = "idle" | "countdown" | "question" | "answering" | "revealing" | "leaderboard" | "finished"
  | "suggesting" | "drawing" | "guessing" | "drawing_reveal"
  | "petitbac_validating"
  | "geoquiz_validating"
  | "langue_validating"
  | "guessgame_validating"
  | "lineup_revealing";

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

  // Drawing mode
  drawingPhrase: string | null;
  drawingToGuess: string | null;
  drawingRevealState: DrawingRevealState | null;
  drawingScores: DrawingRoundResult | null;
  drawingPhase: DrawingPhase | null;

  // Petit Bac mode
  petitBacValidationData: PetitBacValidationData | null;
  petitBacValidatedAnswers: Record<string, string[]> | null;

  // GeoQuiz mode
  geoQuizValidationData: GeoQuizValidationData | null;
  geoQuizValidatedPlayerIds: string[] | null;
  geoQuizHint: string | null;
  geoQuizAnswerResults: GeoQuizAnswerResultData[];
  geoQuizReviewIndex: number;

  // Langue mode
  langueValidationData: LangueValidationData | null;
  langueAnswerResults: LangueAnswerResultData[];

  // Team rounds
  teamData: TeamRoundData | null;
  teamRoundResult: TeamRoundResult | null;

  // GuessGame mode
  guessGameValidationData: GuessGameValidationData | null;
  guessGameAnswerResults: GuessGameAnswerResultData[];

  // Lineup mode
  lineupFoundPlayers: { teamSide: 1 | 2; playerIndex: number; displayName: string; foundByPlayerIds: string[] }[];
  lineupMyFoundCount: number;
  lineupLastGuessCorrect: boolean | null;
  lineupRevealScores: { playerId: string; foundCount: number }[] | null;
  lineupRevealMatch: LineupMatch | null;
  lineupAlsoFoundNotifications: { displayName: string; playerName: string }[];

  // Mode transition
  modeTransition: GameMode | null;

  // Actions
  setStatus: (status: GameStatus) => void;
  setCurrentQuestion: (question: Question, round?: number) => void;
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

  // Drawing actions
  setDrawingPhrase: (phrase: string) => void;
  setDrawingToGuess: (base64: string) => void;
  setDrawingPhase: (phase: DrawingPhase, timeLimit: number) => void;
  setDrawingRevealState: (state: DrawingRevealState) => void;
  updateDrawingRevealStep: (chainIndex: number, step: number) => void;
  setDrawingScores: (result: DrawingRoundResult) => void;

  // Petit Bac actions
  setPetitBacValidation: (data: PetitBacValidationData) => void;
  setPetitBacValidatedAnswers: (validation: PetitBacValidationSubmission) => void;

  // GeoQuiz actions
  setGeoQuizValidation: (data: GeoQuizValidationData) => void;
  setGeoQuizValidatedPlayerIds: (validation: GeoQuizValidationSubmission) => void;
  setGeoQuizHint: (hint: string) => void;
  addGeoQuizAnswerResult: (result: GeoQuizAnswerResultData) => void;

  // Langue actions
  setLangueValidation: (data: LangueValidationData) => void;
  addLangueAnswerResult: (result: LangueAnswerResultData) => void;

  // GuessGame actions
  setGuessGameValidation: (data: GuessGameValidationData) => void;
  addGuessGameAnswerResult: (result: GuessGameAnswerResultData) => void;

  // Lineup actions
  addLineupFoundPlayer: (result: LineupGuessResult, myPlayerId: string, playerName?: string) => void;
  setLineupLastGuessCorrect: (correct: boolean | null) => void;
  setLineupReveal: (match: LineupMatch, scores: { playerId: string; foundCount: number }[]) => void;
  addLineupAlsoFoundNotification: (displayName: string, playerName: string) => void;

  // Mode transition
  setModeTransition: (mode: GameMode | null) => void;

  // Team actions
  setTeamRoundStart: (data: TeamRoundData) => void;
  setTeamRoundEnd: (result: TeamRoundResult) => void;

  // Computed
  getProgress: () => number;
  canSubmitAnswer: () => boolean;
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

  // Drawing initial state
  drawingPhrase: null,
  drawingToGuess: null,
  drawingRevealState: null,
  drawingScores: null,
  drawingPhase: null,

  // Petit Bac initial state
  petitBacValidationData: null,
  petitBacValidatedAnswers: null,

  // GeoQuiz initial state
  geoQuizValidationData: null,
  geoQuizValidatedPlayerIds: null,
  geoQuizHint: null,
  geoQuizAnswerResults: [],
  geoQuizReviewIndex: 0,

  // Langue initial state
  langueValidationData: null,
  langueAnswerResults: [],

  // GuessGame initial state
  guessGameValidationData: null,
  guessGameAnswerResults: [],

  // Lineup initial state
  lineupFoundPlayers: [],
  lineupMyFoundCount: 0,
  lineupLastGuessCorrect: null,
  lineupRevealScores: null,
  lineupRevealMatch: null,
  lineupAlsoFoundNotifications: [],

  // Mode transition initial state
  modeTransition: null,

  // Team initial state
  teamData: null,
  teamRoundResult: null,

  // Actions
  setStatus: (status) => set({ status }),

  setCurrentQuestion: (question, round) =>
    set((state) => ({
      currentQuestion: question,
      currentRound: round ?? state.currentRound,
      timeRemaining: question.timeLimit,
      myAnswer: null,
      hasAnswered: false,
      answeredPlayers: [],
      status: "question",
      geoQuizHint: null,
      lineupFoundPlayers: [],
      lineupMyFoundCount: 0,
      lineupLastGuessCorrect: null,
      lineupAlsoFoundNotifications: [],
    })),

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
      drawingPhrase: null,
      drawingToGuess: null,
      drawingRevealState: null,
      drawingScores: null,
      drawingPhase: null,
      petitBacValidationData: null,
      petitBacValidatedAnswers: null,
      geoQuizValidationData: null,
      geoQuizValidatedPlayerIds: null,
      geoQuizHint: null,
      geoQuizAnswerResults: [],
      geoQuizReviewIndex: 0,
      langueValidationData: null,
      langueAnswerResults: [],
      guessGameValidationData: null,
      guessGameAnswerResults: [],
      lineupFoundPlayers: [],
      lineupMyFoundCount: 0,
      lineupLastGuessCorrect: null,
      lineupRevealScores: null,
      lineupRevealMatch: null,
      modeTransition: null,
      teamData: null,
      teamRoundResult: null,
    }),

  finishGame: () => set({ status: "finished" }),

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
      drawingPhrase: null,
      drawingToGuess: null,
      drawingRevealState: null,
      drawingScores: null,
      drawingPhase: null,
      petitBacValidationData: null,
      petitBacValidatedAnswers: null,
      geoQuizValidationData: null,
      geoQuizValidatedPlayerIds: null,
      geoQuizHint: null,
      geoQuizAnswerResults: [],
      geoQuizReviewIndex: 0,
      langueValidationData: null,
      langueAnswerResults: [],
      guessGameValidationData: null,
      guessGameAnswerResults: [],
      lineupFoundPlayers: [],
      lineupMyFoundCount: 0,
      lineupLastGuessCorrect: null,
      lineupRevealMatch: null,
      modeTransition: null,
      teamData: null,
      teamRoundResult: null,
    }),

  // Drawing actions
  setDrawingPhrase: (phrase) => set({ drawingPhrase: phrase }),

  setDrawingToGuess: (base64) => set({
    drawingToGuess: base64,
    hasAnswered: false,
    answeredPlayers: [],
  }),

  setDrawingPhase: (phase, timeLimit) => set({
    drawingPhase: phase,
    timeRemaining: timeLimit,
    hasAnswered: false,
    answeredPlayers: [],
    status: phase === "suggesting" ? "suggesting" : phase === "drawing" ? "drawing" : phase === "guessing" ? "guessing" : "drawing_reveal",
  }),

  setDrawingRevealState: (state) => set({
    drawingRevealState: state,
    status: "drawing_reveal",
  }),

  updateDrawingRevealStep: (chainIndex, step) => set((state) => ({
    drawingRevealState: state.drawingRevealState
      ? { ...state.drawingRevealState, currentChainIndex: chainIndex, currentStep: step }
      : null,
  })),

  setDrawingScores: (result) => set({ drawingScores: result }),

  // Petit Bac actions
  setPetitBacValidation: (data) => set({
    petitBacValidationData: data,
    status: "petitbac_validating",
  }),

  setPetitBacValidatedAnswers: (validation) => set({
    petitBacValidatedAnswers: validation.validatedAnswers,
  }),

  // GeoQuiz actions
  setGeoQuizValidation: (data) => set({
    geoQuizValidationData: data,
    geoQuizAnswerResults: [],
    geoQuizReviewIndex: 0,
    status: "geoquiz_validating",
  }),

  setGeoQuizValidatedPlayerIds: (validation) => set({
    geoQuizValidatedPlayerIds: validation.validatedPlayerIds,
  }),

  setGeoQuizHint: (hint) => set({
    geoQuizHint: hint,
  }),

  addGeoQuizAnswerResult: (result) => set((state) => ({
    geoQuizAnswerResults: [...state.geoQuizAnswerResults, result],
  })),

  // Langue actions
  setLangueValidation: (data) => set({
    langueValidationData: data,
    langueAnswerResults: [],
    status: "langue_validating",
  }),

  addLangueAnswerResult: (result) => set((state) => ({
    langueAnswerResults: [...state.langueAnswerResults, result],
  })),

  // GuessGame actions
  setGuessGameValidation: (data) => set({
    guessGameValidationData: data,
    guessGameAnswerResults: [],
    status: "guessgame_validating",
  }),

  addGuessGameAnswerResult: (result) => set((state) => ({
    guessGameAnswerResults: [...state.guessGameAnswerResults, result],
  })),

  // Lineup actions
  addLineupFoundPlayer: (result, myPlayerId, playerName) => set((state) => {
    if (!result.correct || result.teamSide === undefined || result.playerIndex === undefined) return {};
    const existingIdx = state.lineupFoundPlayers.findIndex(
      (p) => p.teamSide === result.teamSide && p.playerIndex === result.playerIndex
    );
    if (existingIdx >= 0) {
      // Player already found — add this finder if not already in the list
      const existing = state.lineupFoundPlayers[existingIdx];
      if (existing.foundByPlayerIds.includes(result.playerId)) return {};
      const updated = [...state.lineupFoundPlayers];
      updated[existingIdx] = {
        ...existing,
        foundByPlayerIds: [...existing.foundByPlayerIds, result.playerId],
      };
      // If someone else found a player I already found, add notification
      const notifications = [...state.lineupAlsoFoundNotifications];
      if (result.playerId !== myPlayerId && existing.foundByPlayerIds.includes(myPlayerId) && playerName) {
        notifications.push({ displayName: existing.displayName, playerName });
      }
      return { lineupFoundPlayers: updated, lineupAlsoFoundNotifications: notifications };
    }
    return {
      lineupFoundPlayers: [...state.lineupFoundPlayers, {
        teamSide: result.teamSide!,
        playerIndex: result.playerIndex!,
        displayName: result.displayName || "",
        foundByPlayerIds: [result.playerId],
      }],
    };
  }),

  setLineupLastGuessCorrect: (correct) => set({ lineupLastGuessCorrect: correct }),

  setLineupReveal: (match, scores) => set({
    lineupRevealMatch: match,
    lineupRevealScores: scores,
    status: "lineup_revealing",
  }),

  addLineupAlsoFoundNotification: (displayName, playerName) => set((state) => ({
    lineupAlsoFoundNotifications: [...state.lineupAlsoFoundNotifications, { displayName, playerName }],
  })),

  // Mode transition
  setModeTransition: (mode) => set({ modeTransition: mode }),

  // Team actions
  setTeamRoundStart: (data) => set({ teamData: data, teamRoundResult: null }),
  setTeamRoundEnd: (result) => set((state) => ({
    teamRoundResult: result,
    // Clear teamData if burst is over (remaining was 0)
    teamData: state.teamData && state.teamData.burstRoundsRemaining <= 0 ? null : state.teamData,
  })),

  // Computed
  getProgress: () => {
    const { currentRound, totalRounds } = get();
    return (currentRound / totalRounds) * 100;
  },

  canSubmitAnswer: () => {
    const { status, hasAnswered, timeRemaining } = get();
    return status === "question" && !hasAnswered && timeRemaining > 0;
  },
}));
