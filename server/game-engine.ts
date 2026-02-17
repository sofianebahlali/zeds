import { Server } from "socket.io";
import { RoomManager } from "./room-manager";
import * as fs from "fs";
import * as path from "path";
import type {
  Room,
  Player,
  Question,
  QCMQuestion,
  OpenQuestion,
  ImageQuestion,
  DictationQuestion,
  EstimationQuestion,
  ParcoursQuestion,
  DrawingQuestion,
  PetitBacQuestion,
  PetitBacValidationSubmission,
  PetitBacPlayerAnswerData,
  Answer,
  RoundResult,
  ClientToServerEvents,
  ServerToClientEvents,
  DrawingPhase,
  DrawingChain,
  DrawingRevealState,
  DrawingRoundResult,
  DrawingScoreBreakdown,
} from "../src/types";
import { PETITBAC_CATEGORIES } from "../src/types";

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;

// Sample questions for demo purposes
const SAMPLE_QUESTIONS: Question[] = [
  {
    id: "q1",
    type: "qcm",
    question: "Quelle est la capitale de la France ?",
    options: ["Lyon", "Paris", "Marseille", "Bordeaux"],
    correctIndex: 1,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q2",
    type: "qcm",
    question: "Combien de continents y a-t-il sur Terre ?",
    options: ["5", "6", "7", "8"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q3",
    type: "qcm",
    question: "Quel est le plus grand océan du monde ?",
    options: ["Atlantique", "Indien", "Pacifique", "Arctique"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q4",
    type: "open",
    question: "Quel animal est le meilleur ami de l'homme ?",
    answers: ["chien", "le chien", "un chien"],
    caseSensitive: false,
    timeLimit: 20,
    points: 150,
  },
  {
    id: "q5",
    type: "qcm",
    question: "En quelle année a eu lieu la Révolution française ?",
    options: ["1776", "1789", "1804", "1815"],
    correctIndex: 1,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q6",
    type: "qcm",
    question: "Quel est l'élément chimique avec le symbole 'O' ?",
    options: ["Or", "Osmium", "Oxygène", "Oganesson"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q7",
    type: "open",
    question: "Quelle planète est surnommée la planète rouge ?",
    answers: ["mars", "Mars"],
    caseSensitive: false,
    timeLimit: 15,
    points: 150,
  },
  {
    id: "q8",
    type: "qcm",
    question: "Combien de joueurs composent une équipe de football ?",
    options: ["9", "10", "11", "12"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q9",
    type: "qcm",
    question: "Quel est le plus long fleuve du monde ?",
    options: ["Amazone", "Nil", "Yangtsé", "Mississippi"],
    correctIndex: 1,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q10",
    type: "open",
    question: "Quel fruit est connu pour avoir fait tomber Newton ?",
    answers: ["pomme", "une pomme", "la pomme"],
    caseSensitive: false,
    timeLimit: 15,
    points: 150,
  },
];

const PETITBAC_LETTERS = "ABCDEFGHJKLMNOPRSTV".split("");

export class GameEngine {
  private room: Room;
  private io: TypedIO;
  private roomManager: RoomManager;
  private currentRound: number = 0;
  private currentQuestion: Question | null = null;
  private answers: Map<string, Answer> = new Map();
  private timerInterval: NodeJS.Timeout | null = null;
  private timeRemaining: number = 0;
  private questions: Question[] = [];
  private disconnectedPlayers: Set<string> = new Set();

  // Playlist mode tracking
  private currentMode: string = "";
  private drawingQuestionPool: DrawingQuestion[] = [];

  // Petit Bac state
  private petitBacValidating: boolean = false;

  // Drawing mode state
  private drawingPhase: DrawingPhase = "drawing";
  private playerPhrases: Map<string, { phrase: string; questionId: string }> = new Map();
  private drawings: Map<string, string> = new Map();
  private drawingAssignments: Map<string, string> = new Map(); // guesserId -> artistId
  private guesses: Map<string, string> = new Map();
  private drawingChains: DrawingChain[] = [];
  private revealState: DrawingRevealState | null = null;

  constructor(room: Room, io: TypedIO, roomManager: RoomManager) {
    this.room = room;
    this.io = io;
    this.roomManager = roomManager;
    this.prepareQuestions();
  }

  /**
   * Load estimation questions from JSON file
   */
  private static loadEstimationQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/estimation.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as EstimationQuestion[];
    } catch {
      console.warn("No estimation questions found at", filePath);
      return [];
    }
  }

  /**
   * Load dictation questions from JSON file
   */
  private static loadDictationQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/dictation.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as DictationQuestion[];
    } catch {
      console.warn("No dictation questions found at", filePath);
      return [];
    }
  }

  /**
   * Load drawing questions from JSON file
   */
  private static loadDrawingQuestions(): DrawingQuestion[] {
    const filePath = path.resolve(__dirname, "../data/questions/drawing.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as DrawingQuestion[];
    } catch {
      console.warn("No drawing questions found at", filePath);
      return [];
    }
  }

  /**
   * Load parcours questions from JSON file
   */
  private static loadParcoursQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/parcours.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as ParcoursQuestion[];
    } catch {
      console.warn("No parcours questions found at", filePath);
      return [];
    }
  }

  /**
   * Normalize text for accent-insensitive comparison
   */
  private static normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[''`]/g, "'")          // normalize apostrophes
      .replace(/[-]/g, " ");           // normalize hyphens
  }

  /**
   * Normalize text for dictation comparison (strip punctuation, lowercase, keep accents)
   */
  private static normalizeDictationText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[.,;:!?'"«»()…\[\]{}]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter((w) => w.length > 0);
  }

  /**
   * Longest common subsequence (word-level) for tolerant dictation scoring
   */
  private static wordLCS(a: string[], b: string[]): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    return dp[m][n];
  }

  /**
   * Load questions for a specific mode and return N shuffled questions
   */
  private loadQuestionsForMode(mode: string, count: number): Question[] {
    let pool: Question[];

    switch (mode) {
      case "estimation":
        pool = GameEngine.loadEstimationQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "dictation":
        pool = GameEngine.loadDictationQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "parcours":
        pool = GameEngine.loadParcoursQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "drawing": {
        // For drawing, each "round" is a full draw→guess→reveal cycle
        // We use a placeholder question; actual phrases come from drawingQuestionPool
        const drawingPool = GameEngine.loadDrawingQuestions();
        this.drawingQuestionPool = drawingPool.length > 0
          ? drawingPool.sort(() => Math.random() - 0.5)
          : [];
        const placeholders: Question[] = [];
        for (let i = 0; i < count; i++) {
          placeholders.push({
            id: `drawing_${i + 1}`,
            type: "drawing" as const,
            phrase: "placeholder",
            timeLimit: this.room.settings.roundDuration || 60,
            points: 100,
          });
        }
        return placeholders;
      }
      case "petitbac": {
        const shuffledLetters = [...PETITBAC_LETTERS].sort(() => Math.random() - 0.5);
        const questions: Question[] = [];
        for (let i = 0; i < count; i++) {
          questions.push({
            id: `petitbac_${i + 1}`,
            type: "petitbac" as const,
            letter: shuffledLetters[i % shuffledLetters.length],
            categories: [...PETITBAC_CATEGORIES],
            timeLimit: 120,
            points: 100,
          });
        }
        return questions;
      }
      default:
        pool = [...SAMPLE_QUESTIONS];
        break;
    }

    const shuffled = pool.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Prepare questions for the game from the playlist
   */
  private prepareQuestions(): void {
    const playlist = this.room.settings.playlist;

    if (!playlist || playlist.length === 0) {
      // Fallback: use sample questions
      this.questions = [...SAMPLE_QUESTIONS]
        .sort(() => Math.random() - 0.5)
        .slice(0, this.room.settings.totalRounds);
      return;
    }

    // Build flat question list from playlist segments
    this.questions = [];
    let petitbacCounter = 0;
    let drawingCounter = 0;

    for (const segment of playlist) {
      const segQuestions = this.loadQuestionsForMode(segment.mode, segment.rounds);

      // Re-number IDs to be globally unique
      segQuestions.forEach((q, i) => {
        if (q.type === "petitbac") {
          petitbacCounter++;
          q.id = `petitbac_${petitbacCounter}`;
        } else if (q.type === "drawing") {
          drawingCounter++;
          q.id = `drawing_${drawingCounter}`;
        }
      });

      this.questions.push(...segQuestions);
    }

    // Update totalRounds to match actual questions
    this.room.settings.totalRounds = this.questions.length;
    this.room.totalRounds = this.questions.length;
  }

  /**
   * Start the game
   */
  start(): void {
    this.roomManager.updateRoomStatus(this.room.code, "starting");

    // Send countdown
    let countdown = 3;
    this.io.to(this.room.code).emit("game:starting", countdown);

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        this.io.to(this.room.code).emit("game:starting", countdown);
      } else {
        clearInterval(countdownInterval);
        this.roomManager.updateRoomStatus(this.room.code, "playing");
        this.startRound();
      }
    }, 1000);
  }

  /**
   * Start a new round
   */
  private startRound(): void {
    this.currentRound++;
    this.answers.clear();
    this.roomManager.resetRoundScores(this.room.code);

    if (this.currentRound > this.questions.length) {
      this.finishGame();
      return;
    }

    const nextQuestion = this.questions[this.currentRound - 1];
    const nextMode = nextQuestion.type;

    // Detect mode change and emit event
    if (nextMode !== this.currentMode) {
      this.currentMode = nextMode;
      this.room.gameMode = nextMode;
      this.roomManager.updateGameMode(this.room.code, nextMode);
      this.io.to(this.room.code).emit("game:mode_changed", nextMode);
    }

    // Update room state
    const room = this.roomManager.getRoom(this.room.code);
    if (room) {
      room.currentRound = this.currentRound;
    }

    // Drawing mode has its own multi-phase flow
    if (nextMode === "drawing") {
      this.currentQuestion = nextQuestion;
      this.startDrawingPhase();
      return;
    }

    this.currentQuestion = nextQuestion;
    this.timeRemaining = this.currentQuestion.timeLimit;

    // Send question to all players (sanitized to hide answers)
    const questionForClient = this.sanitizeQuestionForClient(this.currentQuestion);
    this.io.to(this.room.code).emit("game:round_start", this.currentRound, questionForClient);

    // Start timer
    this.startTimer();
  }

  /**
   * Sanitize question before sending to clients (hide answer)
   */
  private sanitizeQuestionForClient(question: Question): Question {
    if (question.type === "open") {
      return {
        ...question,
        answers: [], // Hide answers
      };
    }
    if (question.type === "estimation") {
      return {
        ...question,
        correctValue: 0, // Hide the real price
      };
    }
    if (question.type === "dictation") {
      return {
        ...question,
        text: "", // Hide the correct text
        audioText: undefined, // Don't send audioText to client
      };
    }
    if (question.type === "parcours") {
      return {
        ...question,
        playerName: "", // Hide the player name
        acceptedAnswers: [], // Hide accepted answers
      };
    }
    // petitbac: nothing to hide
    return question;
  }

  /**
   * Start the round timer
   */
  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      this.io.to(this.room.code).emit("game:time_update", this.timeRemaining);

      if (this.timeRemaining <= 0) {
        if (this.currentQuestion?.type === "drawing") {
          this.onDrawingTimerExpired();
        } else {
          this.endRound();
        }
      }
    }, 1000);
  }

  /**
   * Stop the timer
   */
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Submit an answer
   */
  submitAnswer(playerId: string, answerText: string): void {
    if (!this.currentQuestion) return;
    if (this.answers.has(playerId)) return; // Already answered
    if (this.timeRemaining <= 0) return; // Time's up

    const responseTime = this.currentQuestion.timeLimit - this.timeRemaining;

    const answer: Answer = {
      playerId,
      questionId: this.currentQuestion.id,
      answer: answerText,
      timestamp: Date.now(),
      responseTime,
    };

    this.answers.set(playerId, answer);

    // Notify others that player answered (without revealing the answer)
    this.io.to(this.room.code).emit("game:player_answered", playerId);

    // Check if everyone has answered
    const activePlayers = this.room.players.filter(
      (p) => p.isConnected && !this.disconnectedPlayers.has(p.id)
    );

    if (this.answers.size >= activePlayers.length) {
      this.endRound();
    }
  }

  /**
   * End the current round
   */
  private endRound(): void {
    this.stopTimer();

    if (!this.currentQuestion) return;

    // Petit Bac: enter host validation phase instead of auto-scoring
    if (this.currentQuestion.type === "petitbac") {
      this.startPetitBacValidation();
      return;
    }

    // Calculate scores
    const results = this.calculateScores();

    // Update room status
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");

    // Send results
    this.io.to(this.room.code).emit("game:round_end", results);

    // Show leaderboard after a delay
    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      // Auto-proceed to next round after showing leaderboard
      if (this.room.settings.showLeaderboardBetweenRounds) {
        setTimeout(() => {
          this.nextRound();
        }, 5000);
      }
    }, 3000);
  }

  /**
   * Calculate scores for the round
   */
  private calculateScores(): RoundResult {
    if (!this.currentQuestion) {
      throw new Error("No current question");
    }

    const correctAnswer = this.getCorrectAnswer();
    const scores: { playerId: string; points: number; total: number }[] = [];
    let winner: Player | undefined;

    if (this.currentQuestion.type === "estimation") {
      return this.calculateEstimationScores(correctAnswer, scores);
    }

    if (this.currentQuestion.type === "dictation") {
      return this.calculateDictationScores(correctAnswer, scores);
    }

    let fastestCorrectTime = Infinity;

    // Process each answer
    for (const [playerId, answer] of this.answers) {
      const isCorrect = this.checkAnswer(answer.answer);
      answer.isCorrect = isCorrect;

      let points = 0;
      if (isCorrect) {
        // Base points
        points = this.currentQuestion.points;

        // Speed bonus (up to 50% extra for fastest answers)
        const speedBonus = Math.floor(
          (this.currentQuestion.timeLimit - (answer.responseTime || 0)) /
            this.currentQuestion.timeLimit *
            (this.currentQuestion.points * 0.5)
        );
        points += speedBonus;

        answer.points = points;

        // Track fastest correct answer for winner
        if ((answer.responseTime || Infinity) < fastestCorrectTime) {
          fastestCorrectTime = answer.responseTime || Infinity;
          winner = this.room.players.find((p) => p.id === playerId);
        }

        // Update streak
        const player = this.room.players.find((p) => p.id === playerId);
        if (player) {
          player.streak++;
          // Streak bonus
          if (player.streak >= 3) {
            points += 50 * Math.min(player.streak - 2, 5);
          }
        }
      } else {
        // Reset streak on wrong answer
        const player = this.room.players.find((p) => p.id === playerId);
        if (player) {
          player.streak = 0;
        }
      }

      // Update player score
      const updatedPlayer = this.roomManager.updatePlayerScore(playerId, points);
      if (updatedPlayer) {
        scores.push({
          playerId,
          points,
          total: updatedPlayer.score,
        });
      }
    }

    // Players who didn't answer get 0 points
    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
        player.streak = 0;
        scores.push({
          playerId: player.id,
          points: 0,
          total: player.score,
        });
      }
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion,
      answers: Array.from(this.answers.values()),
      correctAnswer,
      winner,
      scores,
    };
  }

  /**
   * Calculate proportional scores for estimation questions
   */
  private calculateEstimationScores(
    correctAnswer: string,
    scores: { playerId: string; points: number; total: number }[]
  ): RoundResult {
    const q = this.currentQuestion as EstimationQuestion;
    const realPrice = q.correctValue;
    let winner: Player | undefined;
    let closestDeviation = Infinity;

    for (const [playerId, answer] of this.answers) {
      const guess = parseFloat(answer.answer.replace(/[^\d.,]/g, "").replace(",", "."));

      if (isNaN(guess)) {
        answer.isCorrect = false;
        answer.points = 0;
        const player = this.room.players.find((p) => p.id === playerId);
        if (player) player.streak = 0;
        const updatedPlayer = this.roomManager.updatePlayerScore(playerId, 0);
        if (updatedPlayer) {
          scores.push({ playerId, points: 0, total: updatedPlayer.score });
        }
        continue;
      }

      // Proportional scoring: score = points * max(0, 1 - |guess - real| / real)
      const deviation = Math.abs(guess - realPrice) / realPrice;
      const proximityScore = Math.max(0, 1 - deviation);
      let points = Math.round(q.points * proximityScore);

      // Consider "correct" if within 15% of real price
      answer.isCorrect = deviation <= 0.15;
      answer.points = points;

      // Streak management
      const player = this.room.players.find((p) => p.id === playerId);
      if (player) {
        if (answer.isCorrect) {
          player.streak++;
          if (player.streak >= 3) {
            points += 50 * Math.min(player.streak - 2, 5);
            answer.points = points;
          }
        } else {
          player.streak = 0;
        }
      }

      // Track closest guess for winner
      if (deviation < closestDeviation) {
        closestDeviation = deviation;
        winner = this.room.players.find((p) => p.id === playerId);
      }

      const updatedPlayer = this.roomManager.updatePlayerScore(playerId, points);
      if (updatedPlayer) {
        scores.push({ playerId, points, total: updatedPlayer.score });
      }
    }

    // Players who didn't answer
    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
        player.streak = 0;
        scores.push({ playerId: player.id, points: 0, total: player.score });
      }
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: Array.from(this.answers.values()),
      correctAnswer,
      winner,
      scores,
    };
  }

  /**
   * Calculate proportional scores for dictation questions
   */
  private calculateDictationScores(
    correctAnswer: string,
    scores: { playerId: string; points: number; total: number }[]
  ): RoundResult {
    const q = this.currentQuestion as DictationQuestion;
    const correctWords = GameEngine.normalizeDictationText(q.text);
    let winner: Player | undefined;
    let bestAccuracy = 0;

    for (const [playerId, answer] of this.answers) {
      const playerWords = GameEngine.normalizeDictationText(answer.answer);
      const lcsLen = GameEngine.wordLCS(playerWords, correctWords);
      const accuracy = correctWords.length > 0 ? lcsLen / correctWords.length : 0;

      let points = Math.round(q.points * accuracy);
      answer.isCorrect = accuracy >= 0.85;
      answer.points = points;

      // Streak management
      const player = this.room.players.find((p) => p.id === playerId);
      if (player) {
        if (answer.isCorrect) {
          player.streak++;
          if (player.streak >= 3) {
            points += 50 * Math.min(player.streak - 2, 5);
            answer.points = points;
          }
        } else {
          player.streak = 0;
        }
      }

      // Track best accuracy for winner
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        winner = this.room.players.find((p) => p.id === playerId);
      }

      const updatedPlayer = this.roomManager.updatePlayerScore(playerId, points);
      if (updatedPlayer) {
        scores.push({ playerId, points, total: updatedPlayer.score });
      }
    }

    // Players who didn't answer
    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
        player.streak = 0;
        scores.push({ playerId: player.id, points: 0, total: player.score });
      }
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: Array.from(this.answers.values()),
      correctAnswer,
      winner,
      scores,
    };
  }

  /**
   * Get the correct answer for the current question
   */
  private getCorrectAnswer(): string {
    if (!this.currentQuestion) return "";

    switch (this.currentQuestion.type) {
      case "qcm":
        return (this.currentQuestion as QCMQuestion).options[
          (this.currentQuestion as QCMQuestion).correctIndex
        ];
      case "open":
        return (this.currentQuestion as OpenQuestion).answers[0];
      case "image":
        return (this.currentQuestion as ImageQuestion).answer;
      case "dictation":
        return (this.currentQuestion as DictationQuestion).text;
      case "estimation": {
        const q = this.currentQuestion as EstimationQuestion;
        return `${q.correctValue.toLocaleString("fr-FR")} ${q.unit}`;
      }
      case "parcours":
        return (this.currentQuestion as ParcoursQuestion).playerName;
      case "petitbac":
        return (this.currentQuestion as PetitBacQuestion).letter;
      default:
        return "";
    }
  }

  /**
   * Check if an answer is correct
   */
  private checkAnswer(answer: string): boolean {
    if (!this.currentQuestion) return false;

    const normalizedAnswer = answer.trim().toLowerCase();

    switch (this.currentQuestion.type) {
      case "qcm": {
        const q = this.currentQuestion as QCMQuestion;
        const correctOption = q.options[q.correctIndex].toLowerCase();
        // Accept both the option text and the index
        return (
          normalizedAnswer === correctOption ||
          normalizedAnswer === String(q.correctIndex)
        );
      }
      case "open": {
        const q = this.currentQuestion as OpenQuestion;
        const validAnswers = q.answers.map((a) =>
          q.caseSensitive ? a.trim() : a.trim().toLowerCase()
        );
        const userAnswer = q.caseSensitive ? answer.trim() : normalizedAnswer;
        return validAnswers.includes(userAnswer);
      }
      case "image": {
        const q = this.currentQuestion as ImageQuestion;
        return normalizedAnswer === q.answer.toLowerCase();
      }
      case "dictation": {
        // Dictation uses proportional scoring, handled in calculateDictationScores
        const q = this.currentQuestion as DictationQuestion;
        const playerWords = GameEngine.normalizeDictationText(answer);
        const correctWords = GameEngine.normalizeDictationText(q.text);
        const lcsLen = GameEngine.wordLCS(playerWords, correctWords);
        const accuracy = correctWords.length > 0 ? lcsLen / correctWords.length : 0;
        return accuracy >= 0.85;
      }
      case "estimation":
        // Estimation scoring is handled in calculateEstimationScores
        return false;
      case "petitbac":
        // Petit Bac scoring is handled manually by host validation
        return false;
      case "parcours": {
        const q = this.currentQuestion as ParcoursQuestion;
        const normalizedInput = GameEngine.normalizeForComparison(answer);
        return q.acceptedAnswers.some(
          (accepted) => GameEngine.normalizeForComparison(accepted) === normalizedInput
        );
      }
      default:
        return false;
    }
  }

  // ==========================================
  // PETIT BAC METHODS
  // ==========================================

  /**
   * Start the validation phase: collect all answers and send to host
   */
  private startPetitBacValidation(): void {
    this.petitBacValidating = true;
    const q = this.currentQuestion as PetitBacQuestion;
    const activePlayers = this.getActivePlayers();

    // Ensure all players have an answer entry (empty if not submitted)
    for (const player of activePlayers) {
      if (!this.answers.has(player.id)) {
        this.answers.set(player.id, {
          playerId: player.id,
          questionId: q.id,
          answer: JSON.stringify({}),
          timestamp: Date.now(),
        });
      }
    }

    const playerAnswers: PetitBacPlayerAnswerData[] = [];
    for (const player of activePlayers) {
      const answer = this.answers.get(player.id);
      let answers: Record<string, string> = {};
      if (answer) {
        try {
          answers = JSON.parse(answer.answer);
        } catch {}
      }
      playerAnswers.push({
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        answers,
      });
    }

    this.io.to(this.room.code).emit("petitbac:validation_start", {
      letter: q.letter,
      categories: q.categories,
      playerAnswers,
    });
  }

  /**
   * Host submits validation results for Petit Bac
   */
  submitPetitBacValidation(validation: PetitBacValidationSubmission): void {
    if (!this.currentQuestion || !this.petitBacValidating) return;
    this.petitBacValidating = false;

    const q = this.currentQuestion as PetitBacQuestion;
    const results = this.calculatePetitBacScores(q, validation);

    // Broadcast validated answers to everyone before round_end
    this.io.to(this.room.code).emit("petitbac:validation_result", validation);

    // Update room status
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");

    // Send results
    this.io.to(this.room.code).emit("game:round_end", results);

    // Show leaderboard after a delay
    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      if (this.room.settings.showLeaderboardBetweenRounds) {
        setTimeout(() => {
          this.nextRound();
        }, 5000);
      }
    }, 3000);
  }

  /**
   * Calculate Petit Bac scores based on host validation
   * - Validated unique answer: 100 points
   * - Validated answer shared with others: 50 points
   * - Rejected/empty: 0 points
   */
  private calculatePetitBacScores(
    q: PetitBacQuestion,
    validation: PetitBacValidationSubmission
  ): RoundResult {
    const scores: { playerId: string; points: number; total: number }[] = [];
    let bestPoints = 0;
    let winner: Player | undefined;

    for (const player of this.room.players) {
      let totalPoints = 0;
      const answer = this.answers.get(player.id);

      let myAnswers: Record<string, string> = {};
      if (answer) {
        try {
          myAnswers = JSON.parse(answer.answer);
        } catch {}
      }

      for (const category of q.categories) {
        const validatedPlayers = validation.validatedAnswers[category] || [];
        if (!validatedPlayers.includes(player.id)) continue;

        const myAnswer = (myAnswers[category] || "").toLowerCase().trim();
        if (!myAnswer) continue;

        // Count validated players with the exact same answer
        let sameAnswerCount = 0;
        for (const vpId of validatedPlayers) {
          const vpAnswerObj = this.answers.get(vpId);
          if (!vpAnswerObj) continue;
          try {
            const parsed = JSON.parse(vpAnswerObj.answer);
            const theirAnswer = (parsed[category] || "").toLowerCase().trim();
            if (theirAnswer === myAnswer) sameAnswerCount++;
          } catch {}
        }

        totalPoints += sameAnswerCount > 1 ? 50 : 100;
      }

      if (answer) {
        answer.points = totalPoints;
        answer.isCorrect = totalPoints > 0;
      }

      const updatedPlayer = this.roomManager.updatePlayerScore(player.id, totalPoints);
      scores.push({
        playerId: player.id,
        points: totalPoints,
        total: updatedPlayer?.score || player.score,
      });

      if (totalPoints > bestPoints) {
        bestPoints = totalPoints;
        winner = player;
      }
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: Array.from(this.answers.values()),
      correctAnswer: q.letter,
      winner,
      scores,
    };
  }

  // ==========================================
  // DRAWING MODE METHODS
  // ==========================================

  private getActivePlayers(): Player[] {
    return this.room.players.filter(
      (p) => p.isConnected && !this.disconnectedPlayers.has(p.id)
    );
  }

  /**
   * Start the drawing phase: assign phrases and begin timer
   */
  private startDrawingPhase(): void {
    this.drawingPhase = "drawing";
    this.drawings.clear();
    this.guesses.clear();
    this.playerPhrases.clear();
    this.drawingAssignments.clear();
    this.drawingChains = [];
    this.revealState = null;

    const activePlayers = this.getActivePlayers();

    if (activePlayers.length < 3) {
      this.io.to(this.room.code).emit("room:error", "Il faut au moins 3 joueurs pour le mode dessin");
      this.nextRound();
      return;
    }

    // Use the drawing question pool for phrase assignment
    const phrasePool = this.drawingQuestionPool.length > 0
      ? this.drawingQuestionPool
      : [{ id: "fallback", type: "drawing" as const, phrase: "Un chat qui joue du piano", timeLimit: 60, points: 100 }];
    const shuffled = [...phrasePool].sort(() => Math.random() - 0.5);
    activePlayers.forEach((player, index) => {
      const q = shuffled[index % shuffled.length];
      this.playerPhrases.set(player.id, { phrase: q.phrase, questionId: q.id });
    });

    // Build circular rotation: player[i] draws -> player[(i+1) % n] guesses
    for (let i = 0; i < activePlayers.length; i++) {
      const artist = activePlayers[i];
      const guesser = activePlayers[(i + 1) % activePlayers.length];
      this.drawingAssignments.set(guesser.id, artist.id);
    }

    const timeLimit = this.room.settings.roundDuration || 60;
    this.timeRemaining = timeLimit;

    // Emit phase start to room
    this.io.to(this.room.code).emit("drawing:phase_start", "drawing", {
      phase: "drawing",
      timeLimit,
      totalPlayers: activePlayers.length,
    });

    // Send each player their individual phrase
    for (const player of activePlayers) {
      const phraseData = this.playerPhrases.get(player.id)!;
      const socketId = this.roomManager.getSocketIdFromPlayerId(player.id);
      if (socketId) {
        this.io.to(socketId).emit("drawing:your_phrase", phraseData.phrase, phraseData.questionId);
      }
    }

    this.startTimer();
  }

  /**
   * Handle drawing timer expiration
   */
  private onDrawingTimerExpired(): void {
    this.stopTimer();

    if (this.drawingPhase === "drawing") {
      this.startGuessingPhase();
    } else if (this.drawingPhase === "guessing") {
      this.startRevealPhase();
    }
  }

  /**
   * Submit a drawing (base64 image)
   */
  submitDrawing(playerId: string, drawingBase64: string): void {
    if (this.drawingPhase !== "drawing") return;
    if (this.drawings.has(playerId)) return;

    this.drawings.set(playerId, drawingBase64);
    this.io.to(this.room.code).emit("game:player_answered", playerId);

    // Check if all active players submitted
    const activePlayers = this.getActivePlayers();
    if (this.drawings.size >= activePlayers.length) {
      this.stopTimer();
      this.startGuessingPhase();
    }
  }

  /**
   * Start the guessing phase: distribute drawings to guessers
   */
  private startGuessingPhase(): void {
    this.drawingPhase = "guessing";

    const timeLimit = Math.min(this.room.settings.roundDuration || 60, 45);
    this.timeRemaining = timeLimit;

    this.io.to(this.room.code).emit("drawing:phase_start", "guessing", {
      phase: "guessing",
      timeLimit,
      totalPlayers: this.drawings.size,
    });

    // Send each guesser the drawing they need to guess
    const activePlayers = this.getActivePlayers();
    for (const player of activePlayers) {
      const artistId = this.drawingAssignments.get(player.id);
      if (artistId) {
        const drawingData = this.drawings.get(artistId) || "";
        const socketId = this.roomManager.getSocketIdFromPlayerId(player.id);
        if (socketId && drawingData) {
          this.io.to(socketId).emit("drawing:your_guess_target", drawingData);
        }
      }
    }

    this.startTimer();
  }

  /**
   * Submit a guess for a drawing
   */
  submitGuess(playerId: string, guess: string): void {
    if (this.drawingPhase !== "guessing") return;
    if (this.guesses.has(playerId)) return;

    this.guesses.set(playerId, guess);
    this.io.to(this.room.code).emit("game:player_answered", playerId);

    const activePlayers = this.getActivePlayers();
    if (this.guesses.size >= activePlayers.length) {
      this.stopTimer();
      this.startRevealPhase();
    }
  }

  /**
   * Start the reveal phase: build chains, calculate scores, let host navigate
   */
  private startRevealPhase(): void {
    this.drawingPhase = "revealing";

    const activePlayers = this.getActivePlayers();

    // Build chains
    this.drawingChains = [];
    for (const artist of activePlayers) {
      const phraseData = this.playerPhrases.get(artist.id);
      const drawingData = this.drawings.get(artist.id);
      if (!phraseData) continue;

      // Find the guesser for this artist
      let guesserId = "";
      for (const [gId, aId] of this.drawingAssignments) {
        if (aId === artist.id) { guesserId = gId; break; }
      }

      const guesser = this.room.players.find((p) => p.id === guesserId);
      const guess = this.guesses.get(guesserId) || "";
      const isCorrect = this.fuzzyMatchDrawingGuess(phraseData.phrase, guess);

      this.drawingChains.push({
        artistId: artist.id,
        artistName: artist.name,
        artistAvatar: artist.avatar,
        phrase: phraseData.phrase,
        drawingData: drawingData || "",
        guesserId,
        guesserName: guesser?.name || "???",
        guesserAvatar: guesser?.avatar || "🦊",
        guess,
        isGuessCorrect: isCorrect,
      });
    }

    // Calculate scores
    const scores = this.calculateDrawingScores();

    // Initialize reveal navigation
    this.revealState = {
      chains: this.drawingChains,
      currentChainIndex: 0,
      currentStep: 0,
    };

    this.io.to(this.room.code).emit("drawing:reveal_state", this.revealState);
    this.io.to(this.room.code).emit("drawing:round_scores", {
      roundNumber: this.currentRound,
      chains: this.drawingChains,
      scores,
    });
  }

  /**
   * Fuzzy match a guess against the original drawing phrase
   */
  private fuzzyMatchDrawingGuess(phrase: string, guess: string): boolean {
    const normalize = (s: string) => s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    const normalizedPhrase = normalize(phrase);
    const normalizedGuess = normalize(guess);

    if (!normalizedGuess) return false;
    if (normalizedPhrase === normalizedGuess) return true;

    // Check word-level similarity
    const phraseWords = normalizedPhrase.split(/\s+/).filter((w) => w.length > 2);
    const guessWords = normalizedGuess.split(/\s+/).filter((w) => w.length > 2);

    if (phraseWords.length === 0) return normalizedPhrase === normalizedGuess;

    const matchingWords = phraseWords.filter((pw) =>
      guessWords.some((gw) => GameEngine.levenshteinSimilarity(pw, gw) >= 0.75)
    );

    return matchingWords.length / phraseWords.length >= 0.6;
  }

  /**
   * Levenshtein-based string similarity (0 to 1)
   */
  private static levenshteinSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    const matrix: number[][] = [];
    for (let i = 0; i <= a.length; i++) matrix[i] = [i];
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return 1 - matrix[a.length][b.length] / maxLen;
  }

  /**
   * Calculate drawing scores: +100 if your drawing was guessed, +100 if you guessed correctly
   */
  private calculateDrawingScores(): { playerId: string; points: number; total: number; breakdown: DrawingScoreBreakdown }[] {
    const scores: { playerId: string; points: number; total: number; breakdown: DrawingScoreBreakdown }[] = [];
    const activePlayers = this.getActivePlayers();

    for (const player of activePlayers) {
      const chainAsArtist = this.drawingChains.find((c) => c.artistId === player.id);
      const drawingGuessedByOther = chainAsArtist?.isGuessCorrect || false;

      const chainAsGuesser = this.drawingChains.find((c) => c.guesserId === player.id);
      const youGuessedCorrectly = chainAsGuesser?.isGuessCorrect || false;

      let points = 0;
      if (drawingGuessedByOther) points += 100;
      if (youGuessedCorrectly) points += 100;

      const updatedPlayer = this.roomManager.updatePlayerScore(player.id, points);

      scores.push({
        playerId: player.id,
        points,
        total: updatedPlayer?.score || 0,
        breakdown: {
          drawingGuessedByOther,
          youGuessedCorrectly,
          totalForRound: (drawingGuessedByOther ? 1 : 0) + (youGuessedCorrectly ? 1 : 0),
        },
      });
    }

    return scores;
  }

  /**
   * Host advances the reveal (next step or next chain)
   */
  advanceReveal(): void {
    if (!this.revealState) return;

    const totalSteps = 4;
    const totalChains = this.revealState.chains.length;

    if (this.revealState.currentStep < totalSteps - 1) {
      this.revealState.currentStep++;
    } else if (this.revealState.currentChainIndex < totalChains - 1) {
      this.revealState.currentChainIndex++;
      this.revealState.currentStep = 0;
    } else {
      // All chains revealed — show leaderboard then proceed
      this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      setTimeout(() => {
        this.nextRound();
      }, 5000);
      return;
    }

    this.io.to(this.room.code).emit("drawing:reveal_step",
      this.revealState.currentChainIndex,
      this.revealState.currentStep
    );
  }

  /**
   * Host goes back in the reveal
   */
  retreatReveal(): void {
    if (!this.revealState) return;

    if (this.revealState.currentStep > 0) {
      this.revealState.currentStep--;
    } else if (this.revealState.currentChainIndex > 0) {
      this.revealState.currentChainIndex--;
      this.revealState.currentStep = 3;
    }

    this.io.to(this.room.code).emit("drawing:reveal_step",
      this.revealState.currentChainIndex,
      this.revealState.currentStep
    );
  }

  /**
   * Proceed to the next round
   */
  nextRound(): void {
    if (this.currentRound >= this.questions.length) {
      this.finishGame();
    } else {
      this.startRound();
    }
  }

  /**
   * Finish the game
   */
  private finishGame(): void {
    this.stopTimer();
    this.roomManager.updateRoomStatus(this.room.code, "finished");

    const finalScores = this.roomManager.getLeaderboard(this.room.code);
    this.io.to(this.room.code).emit("game:finished", finalScores);
  }

  /**
   * Handle player disconnect during game
   */
  handlePlayerDisconnect(playerId: string): void {
    this.disconnectedPlayers.add(playerId);

    // Check if remaining players have all answered
    const activePlayers = this.room.players.filter(
      (p) => p.isConnected && !this.disconnectedPlayers.has(p.id)
    );

    if (this.answers.size >= activePlayers.length && activePlayers.length > 0) {
      this.endRound();
    }

    // If no players left, end the game
    if (activePlayers.length <= 0) {
      this.finishGame();
    }
  }

  /**
   * Handle player reconnect
   */
  handlePlayerReconnect(playerId: string): void {
    this.disconnectedPlayers.delete(playerId);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopTimer();
  }
}
