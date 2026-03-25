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
  GeoQuizQuestion,
  GeoQuizValidationSubmission,
  GeoQuizPlayerAnswerData,
  LangueQuestion,
  LangueValidationSubmission,
  LanguePlayerAnswerData,
  MathsQuestion,
  GuessGameQuestion,
  ParcoursValidationSubmission,
  GuessGameValidationSubmission,
  LineupQuestion,
  LineupMatch,
  LineupGuessResult,
  JerseyNumberQuestion,
  FutCardQuestion,
  ChronoQuestion,
  ConsensusQuestion,
  ConsensusValidationSubmission,
  SplitStealQuestion,
  SplitStealStartData,
  SplitStealChoiceEntry,
  SplitStealRevealData,
  Answer,
  RoundResult,
  ClientToServerEvents,
  ServerToClientEvents,
  DrawingPhase,
  DrawingChain,
  DrawingRevealState,
  DrawingRoundResult,
  DrawingScoreBreakdown,
  TeamInfo,
  TeamRoundData,
  TeamRoundResult,
  ListeQuestion,
  ListeItem,
  ListeFoundItem,
  ListePlayerState,
  ListeProgressData,
  ListeRoundResult,
  LettresQuestion,
  LettresDrawData,
  LettresLetterDrawnData,
  LettresPlayerAnswerData,
  LettresValidationData,
  LettresAnswerResultData,
  DialedQuestion,
} from "../src/types";
import { PETITBAC_ALL_CATEGORIES, PETITBAC_CATEGORIES_PER_ROUND } from "../src/types";
import { getQuestions as getDbQuestions, getTotalCount as getDbTotalCount } from "./question-db";

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;

// Sample questions for demo/fallback (sport, jeux vidéo, manga)
const SAMPLE_QUESTIONS: Question[] = [
  {
    id: "q1",
    type: "qcm",
    question: "Combien de joueurs composent une équipe de football ?",
    options: ["9", "10", "11", "12"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q2",
    type: "qcm",
    question: "Quel pays a remporté la Coupe du Monde 2022 ?",
    options: ["Brésil", "France", "Argentine", "Croatie"],
    correctIndex: 2,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q3",
    type: "qcm",
    question: "Dans quel jeu vidéo incarne-t-on Link ?",
    options: ["Mario", "Zelda", "Metroid", "Pokémon"],
    correctIndex: 1,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q4",
    type: "open",
    question: "Quel est le manga le plus vendu au monde ?",
    answers: ["one piece", "One Piece"],
    caseSensitive: false,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q5",
    type: "qcm",
    question: "Combien de Grand Chelem Rafael Nadal a-t-il remportés ?",
    options: ["18", "20", "22", "24"],
    correctIndex: 2,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q6",
    type: "qcm",
    question: "Quel personnage de manga possède le Gear 5 ?",
    options: ["Naruto", "Goku", "Luffy", "Ichigo"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q7",
    type: "open",
    question: "Quel joueur NBA est surnommé 'The King' ?",
    answers: ["lebron james", "lebron", "LeBron James"],
    caseSensitive: false,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q8",
    type: "qcm",
    question: "Quel est le jeu le plus vendu de tous les temps ?",
    options: ["GTA V", "Minecraft", "Tetris", "Wii Sports"],
    correctIndex: 1,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q9",
    type: "qcm",
    question: "Dans Dragon Ball, quelle est la transformation ultime de Goku ?",
    options: ["Super Saiyan 3", "Super Saiyan God", "Ultra Instinct", "Super Saiyan Blue"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q10",
    type: "open",
    question: "Quel footballeur est surnommé CR7 ?",
    answers: ["cristiano ronaldo", "ronaldo", "Cristiano Ronaldo"],
    caseSensitive: false,
    timeLimit: 15,
    points: 100,
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
  private usedQuestionDbIds: Set<number> = new Set(); // Track used SQLite question IDs per session

  // Playlist mode tracking
  private currentMode: string = "";
  private drawingQuestionPool: DrawingQuestion[] = [];

  // Petit Bac state
  private petitBacValidating: boolean = false;
  private petitBacGracePeriod: boolean = false;
  private petitBacStopTriggered: boolean = false;
  private petitBacStopTimer: NodeJS.Timeout | null = null;

  // GeoQuiz state
  private geoQuizValidating: boolean = false;
  private geoQuizHintUsers: Set<string> = new Set(); // Players who used the hint
  private geoQuizAutoValidationTimer: NodeJS.Timeout | null = null;
  private geoQuizDecisions: Map<string, boolean> = new Map();
  private geoQuizPlayerAnswers: GeoQuizPlayerAnswerData[] = [];

  // Langue state
  private langueValidating: boolean = false;
  private langueAutoValidationTimer: NodeJS.Timeout | null = null;
  private langueDecisions: Map<string, { languageCorrect: boolean; meaningCorrect: boolean }> = new Map();
  private languePlayerAnswers: LanguePlayerAnswerData[] = [];

  // Parcours validation state
  private parcoursValidating: boolean = false;
  private parcoursAutoValidationTimer: NodeJS.Timeout | null = null;
  private parcoursDecisions: Map<string, boolean> = new Map();
  private parcoursPlayerAnswers: { playerId: string; playerName: string; playerAvatar: string; answer: string }[] = [];

  // GuessGame validation state
  private guessGameValidating: boolean = false;
  private guessGameAutoValidationTimer: NodeJS.Timeout | null = null;
  private guessGameDecisions: Map<string, boolean> = new Map();
  private guessGamePlayerAnswers: { playerId: string; playerName: string; playerAvatar: string; answer: string }[] = [];

  // Consensus validation state
  private consensusValidating: boolean = false;
  private consensusAutoValidationTimer: NodeJS.Timeout | null = null;
  private consensusDecisions: Map<string, boolean> = new Map();
  private consensusPlayerAnswers: { playerId: string; playerName: string; playerAvatar: string; answer: string }[] = [];

  // Drawing mode state
  private drawingPhase: DrawingPhase = "drawing";
  private suggestions: Map<string, string> = new Map(); // suggesterId -> suggested phrase
  private suggestionAssignments: Map<string, string> = new Map(); // drawerId -> suggesterId
  private playerPhrases: Map<string, { phrase: string; questionId: string }> = new Map();
  private drawings: Map<string, string> = new Map();
  private drawingAssignments: Map<string, string> = new Map(); // guesserId -> artistId
  private guesses: Map<string, string> = new Map();
  private drawingChains: DrawingChain[] = [];
  private revealState: DrawingRevealState | null = null;
  private lastDrawingScores: { playerId: string; points: number }[] = [];
  private drawingValidating: boolean = false;
  private drawingAutoValidationTimer: NodeJS.Timeout | null = null;
  private drawingChainDecisions: Map<number, boolean> = new Map();

  // Lineup mode state
  private lineupFoundPlayers: Map<string, Set<number>> = new Map(); // playerId -> set of found player global indices (0-21)
  private lineupGlobalFound: Map<number, Set<string>> = new Map(); // global player index -> set of playerIds who found them
  private lineupRevealTimer: NodeJS.Timeout | null = null;

  // Split or Steal state
  private splitStealChoices: Map<string, "split" | "steal"> = new Map();
  private splitStealPairingType: "pair" | "cycle" = "pair";
  private splitStealPairs: [string, string][] = []; // For pairs: [A, B] means A↔B
  private splitStealCycle: string[] = []; // For cycle: [A, B, C] means A→B→C→A

  // Valise Mystère state (2-player Split or Steal)
  private valiseMode: boolean = false;
  private valisePorteurId: string = "";
  private valiseVoleurId: string = "";
  private valiseValue: number = 0;
  private valisePorteurSignal: "prends" | "laisse" | null = null;
  private valiseVoleurChoice: "voler" | "laisser" | null = null;
  private valiseRoundIndex: number = 0; // tracks alternation

  // Liste mode state
  private listeFoundItems: Map<string, Set<number>> = new Map(); // playerId -> set of found item indices
  private listeGlobalFound: Map<number, string> = new Map(); // item index -> first playerId who found it
  private listeFinishedPlayers: Set<string> = new Set(); // players who clicked "J'ai fini"

  // Lettres mode state
  private lettresLetters: string[] = [];
  private lettresVowelCount: number = 0;
  private lettresConsonantCount: number = 0;
  private lettresPickOrder: string[] = []; // player IDs in pick order
  private lettresCurrentPickIndex: number = 0;
  private lettresPickTimer: NodeJS.Timeout | null = null;
  private lettresValidating: boolean = false;
  private lettresAutoValidationTimer: NodeJS.Timeout | null = null;
  private lettresDecisions: Map<string, boolean> = new Map();
  private lettresPlayerAnswers: LettresPlayerAnswerData[] = [];

  // Lettres letter pools (French Scrabble-inspired frequencies, no accents)
  private static readonly LETTRES_VOWELS: [string, number][] = [
    ["A", 9], ["E", 15], ["I", 8], ["O", 6], ["U", 6], ["Y", 1],
  ];
  private static readonly LETTRES_CONSONANTS: [string, number][] = [
    ["B", 2], ["C", 3], ["D", 3], ["F", 2], ["G", 2], ["H", 2],
    ["J", 1], ["K", 1], ["L", 5], ["M", 3], ["N", 6], ["P", 2],
    ["Q", 1], ["R", 6], ["S", 6], ["T", 6], ["V", 2], ["W", 1],
    ["X", 1], ["Z", 1],
  ];
  private static readonly LETTRES_TOTAL_PICKS = 9;
  private static readonly LETTRES_MIN_VOWELS = 2;
  private static readonly LETTRES_MIN_CONSONANTS = 2;
  private static readonly LETTRES_TIME_PER_PICK = 5; // seconds
  private static readonly LETTRES_FIND_TIME = 25; // seconds

  // Team rounds state
  private teamRoundsEnabled: boolean = false;
  private currentTeams: TeamInfo[] | null = null;
  private teamBurstRemaining: number = 0;

  // Comeback mode state ("Aide aux derniers")
  private comebackMode: boolean = false;
  private comebackBonusPlayerId: string | null = null; // player who gets x2 this round
  private comebackPickTimer: NodeJS.Timeout | null = null;

  constructor(room: Room, io: TypedIO, roomManager: RoomManager) {
    this.room = room;
    this.io = io;
    this.roomManager = roomManager;
    this.teamRoundsEnabled = room.settings.teamRoundsEnabled ?? false;
    this.comebackMode = room.settings.comebackMode ?? false;
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
   * Load geoquiz questions from JSON file
   */
  private static loadGeoQuizQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/geoquiz.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as GeoQuizQuestion[];
    } catch {
      console.warn("No geoquiz questions found at", filePath);
      return [];
    }
  }

  /**
   * Load langue questions from JSON file
   */
  private static loadLangueQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/langue.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as LangueQuestion[];
    } catch {
      console.warn("No langue questions found at", filePath);
      return [];
    }
  }

  private static loadMathsQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/maths.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as MathsQuestion[];
    } catch {
      console.warn("No maths questions found at", filePath);
      return [];
    }
  }

  private static loadGuessGameQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/guessgame.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as GuessGameQuestion[];
    } catch {
      console.warn("No guessgame questions found at", filePath);
      return [];
    }
  }

  private static loadLineupMatches(): LineupMatch[] {
    const filePath = path.resolve(__dirname, "../data/questions/lineups.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as LineupMatch[];
    } catch {
      console.warn("No lineup questions found at", filePath);
      return [];
    }
  }

  private static loadJerseyNumberQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/jerseynumber.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as JerseyNumberQuestion[];
    } catch {
      console.warn("No jerseynumber questions found at", filePath);
      return [];
    }
  }

  private static loadFutCardQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/futcard.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as FutCardQuestion[];
    } catch {
      console.warn("No futcard questions found at", filePath);
      return [];
    }
  }

  private static loadChronoQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/chrono.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as ChronoQuestion[];
    } catch {
      console.warn("No chrono questions found at", filePath);
      return [];
    }
  }

  private static loadDialedQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/dialed.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as DialedQuestion[];
    } catch {
      console.warn("No dialed questions found at", filePath);
      return [];
    }
  }

  private static loadConsensusQuestions(): Question[] {
    const filePath = path.resolve(__dirname, "../data/questions/consensus.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as ConsensusQuestion[];
    } catch {
      console.warn("No consensus questions found at", filePath);
      return [];
    }
  }

  private static loadListeQuizzes(): { id: string; title: string; category: string; subcategory: string; difficulty: string; items: ListeItem[] }[] {
    const dir = path.resolve(__dirname, "../data/football-quizzes");
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));
      const quizzes: { id: string; title: string; category: string; subcategory: string; difficulty: string; items: ListeItem[] }[] = [];
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(dir, file), "utf-8");
          const quiz = JSON.parse(raw);
          if (quiz.items && Array.isArray(quiz.items)) {
            quizzes.push(quiz);
          }
        } catch {
          console.warn(`Failed to load liste quiz: ${file}`);
        }
      }
      return quizzes;
    } catch {
      console.warn("No football-quizzes directory found at", dir);
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
   * Load QCM/Open questions from SQLite database, with session-level deduplication
   */
  private loadQuestionsFromDb(mode: "qcm" | "open", count: number): Question[] {
    const dbTotal = getDbTotalCount();
    if (dbTotal === 0) return [];

    const questions = getDbQuestions({
      count,
      excludeIds: this.usedQuestionDbIds,
    });

    // Track used IDs for session deduplication
    for (const q of questions) {
      const numId = parseInt(q.id.replace("db_", ""), 10);
      if (!isNaN(numId)) this.usedQuestionDbIds.add(numId);
    }

    // Override type if specifically requesting "open" mode
    if (mode === "open") {
      return questions.map((q) => {
        if (q.type === "qcm") {
          const qcm = q as QCMQuestion;
          return {
            id: qcm.id,
            type: "open" as const,
            question: qcm.question,
            answers: [qcm.options[qcm.correctIndex]],
            caseSensitive: false,
            timeLimit: 20,
            points: 100,
          } as OpenQuestion;
        }
        return q;
      });
    }

    return questions;
  }

  /**
   * Load questions for a specific mode and return N shuffled questions
   */
  private loadQuestionsForMode(mode: string, count: number): Question[] {
    let pool: Question[];

    switch (mode) {
      case "qcm": {
        // Try SQLite database first
        const dbQuestions = this.loadQuestionsFromDb("qcm", count);
        if (dbQuestions.length >= count) return dbQuestions;
        // Fallback: pad with sample questions if DB doesn't have enough
        pool = [...dbQuestions, ...SAMPLE_QUESTIONS.filter((q) => q.type === "qcm")];
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      }
      case "open": {
        // Try SQLite database first (converts QCM to Open)
        const dbQuestions = this.loadQuestionsFromDb("open", count);
        if (dbQuestions.length >= count) return dbQuestions;
        pool = [...dbQuestions, ...SAMPLE_QUESTIONS.filter((q) => q.type === "open")];
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      }
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
      case "geoquiz":
        pool = GameEngine.loadGeoQuizQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "langue":
        pool = GameEngine.loadLangueQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "maths":
        pool = GameEngine.loadMathsQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "guessgame":
        pool = GameEngine.loadGuessGameQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "lineup": {
        const matches = GameEngine.loadLineupMatches();
        if (matches.length === 0) {
          pool = [...SAMPLE_QUESTIONS];
          break;
        }
        const shuffledMatches = matches.sort(() => Math.random() - 0.5).slice(0, count);
        return shuffledMatches.map((match, i) => ({
          id: `lineup_${i + 1}`,
          type: "lineup" as const,
          match,
          timeLimit: 120,
          points: 10, // points per player found
        }));
      }
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
            timeLimit: this.room.settings.roundDuration || 90,
            points: 100,
          });
        }
        return placeholders;
      }
      case "petitbac": {
        const shuffledLetters = [...PETITBAC_LETTERS].sort(() => Math.random() - 0.5);
        const questions: Question[] = [];
        for (let i = 0; i < count; i++) {
          // Pick random categories for each round
          const shuffledCategories = [...PETITBAC_ALL_CATEGORIES].sort(() => Math.random() - 0.5);
          const roundCategories = shuffledCategories.slice(0, PETITBAC_CATEGORIES_PER_ROUND);
          questions.push({
            id: `petitbac_${i + 1}`,
            type: "petitbac" as const,
            letter: shuffledLetters[i % shuffledLetters.length],
            categories: roundCategories,
            timeLimit: 60,
            points: 100,
          });
        }
        return questions;
      }
      case "jerseynumber":
        pool = GameEngine.loadJerseyNumberQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "futcard":
        pool = GameEngine.loadFutCardQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "chrono":
        pool = GameEngine.loadChronoQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "consensus":
        pool = GameEngine.loadConsensusQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
      case "splitsteal": {
        const questions: Question[] = [];
        for (let i = 0; i < count; i++) {
          questions.push({
            id: `splitsteal_${i + 1}`,
            type: "splitsteal" as const,
            timeLimit: 15,
            points: 250,
          });
        }
        return questions;
      }
      case "liste": {
        const quizzes = GameEngine.loadListeQuizzes();
        if (quizzes.length === 0) {
          return [...SAMPLE_QUESTIONS].slice(0, count);
        }
        const shuffled = quizzes.sort(() => Math.random() - 0.5).slice(0, count);
        return shuffled.map((quiz, i) => {
          const itemCount = quiz.items.length;
          const timeLimit = Math.max(90, Math.min(360, itemCount * 8));
          const basePoints = Math.max(150, Math.min(300, itemCount * 10));
          return {
            id: `liste_${i + 1}`,
            type: "liste" as const,
            title: quiz.title,
            quizId: quiz.id,
            category: quiz.category,
            subcategory: quiz.subcategory,
            difficulty: quiz.difficulty as "easy" | "medium" | "hard" | "very-hard",
            items: quiz.items,
            timeLimit,
            points: basePoints, // total base points for the quiz
          };
        });
      }
      case "lettres": {
        const questions: Question[] = [];
        for (let i = 0; i < count; i++) {
          questions.push({
            id: `lettres_${i + 1}`,
            type: "lettres" as const,
            timeLimit: GameEngine.LETTRES_FIND_TIME,
            points: 100,
          });
        }
        return questions;
      }
      case "dialed":
        pool = GameEngine.loadDialedQuestions();
        if (pool.length === 0) pool = [...SAMPLE_QUESTIONS];
        break;
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
    // Comeback mode: questions are loaded dynamically as the last player picks
    if (this.comebackMode) {
      this.questions = [];
      const total = this.room.settings.comebackTotalRounds || 15;
      this.room.settings.totalRounds = total;
      this.room.totalRounds = total;
      return;
    }

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

    // Shuffle questions across modes if enabled
    if (this.room.settings.shufflePlaylist) {
      this.questions = this.questions.sort(() => Math.random() - 0.5);
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

    // Comeback mode: check if we've reached the total
    if (this.comebackMode) {
      const total = this.room.settings.comebackTotalRounds || 15;
      if (this.currentRound > total) {
        this.finishGame();
        return;
      }
      // Round 1: random mode. Round 2+: last player picks
      if (this.currentRound === 1) {
        this.comebackBonusPlayerId = null;
        this.comebackLoadRandomAndStart();
        return;
      } else {
        // Find the last player(s) in the leaderboard
        const lastPlayer = this.getComebackLastPlayer();
        this.comebackBonusPlayerId = lastPlayer.id;
        this.startComebackPick(lastPlayer);
        return;
      }
    }

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

    // Team burst logic (skip for drawing, lineup, and lettres modes)
    if (this.teamRoundsEnabled && nextMode !== "drawing" && nextMode !== "lineup" && nextMode !== "lettres") {
      if (this.teamBurstRemaining > 0) {
        // Already in a burst, decrement and re-emit
        this.teamBurstRemaining--;
        this.io.to(this.room.code).emit("game:team_round_start", {
          teams: this.currentTeams!,
          burstRoundsRemaining: this.teamBurstRemaining,
        });
      } else if (this.currentTeams === null && Math.random() < 0.3) {
        // ~30% chance to start a new burst
        const burstLength = 1 + Math.floor(Math.random() * 3); // 1-3
        this.teamBurstRemaining = burstLength - 1; // -1 because current round counts
        this.currentTeams = this.splitPlayersIntoTeams();
        this.io.to(this.room.code).emit("game:team_round_start", {
          teams: this.currentTeams,
          burstRoundsRemaining: this.teamBurstRemaining,
        });
      }
    }

    // Split or Steal mode has its own phase flow
    if (nextMode === "splitsteal") {
      this.currentQuestion = nextQuestion;
      this.startSplitStealPhase();
      return;
    }

    // Drawing mode has its own multi-phase flow (suggest → draw → guess → reveal)
    if (nextMode === "drawing") {
      this.currentQuestion = nextQuestion;
      this.startSuggestionPhase();
      return;
    }

    // Lettres mode has its own multi-phase flow (draw → find → validate)
    if (nextMode === "lettres") {
      this.currentQuestion = nextQuestion;
      this.startLettresDrawPhase();
      return;
    }

    // Lineup mode: reset per-round tracking
    if (nextMode === "lineup") {
      this.lineupFoundPlayers.clear();
      this.lineupGlobalFound.clear();
    }

    // Liste mode: reset per-round tracking
    if (nextMode === "liste") {
      this.listeFoundItems.clear();
      this.listeGlobalFound.clear();
      this.listeFinishedPlayers.clear();
    }

    // Petit Bac: reset stop state
    this.petitBacStopTriggered = false;
    if (this.petitBacStopTimer) {
      clearTimeout(this.petitBacStopTimer);
      this.petitBacStopTimer = null;
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
    if (question.type === "geoquiz") {
      return {
        ...question,
        city: "", // Hide the city name
        acceptedAnswers: [], // Hide accepted answers
        hint: "", // Hide hint (revealed via socket event)
      };
    }
    if (question.type === "langue") {
      return {
        ...question,
        language: "",
        meaning: "",
        acceptedLanguages: [],
        acceptedMeanings: [],
      };
    }
    if (question.type === "guessgame") {
      return {
        ...question,
        gameTitle: "",
        acceptedAnswers: [],
      };
    }
    if (question.type === "lineup") {
      // Send match info but hide player names — client shows empty slots
      const hideTeamPlayers = (team: LineupMatch["team1"]) => ({
        ...team,
        players: team.players.map((p) => ({
          pos: p.pos,
          name: "",
          num: p.num,
          alt: [],
        })),
      });
      return {
        ...question,
        match: {
          ...question.match,
          team1: hideTeamPlayers(question.match.team1),
          team2: hideTeamPlayers(question.match.team2),
        },
      };
    }
    if (question.type === "liste") {
      // Send quiz metadata but hide the actual answers — client only sees count and title
      return {
        ...question,
        items: question.items.map((item) => ({
          answer: "",
          aliases: [],
          hint: item.hint || "",
        })),
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
        } else if (this.currentQuestion?.type === "splitsteal" && this.valiseMode) {
          this.resolveValise();
        } else if (this.currentQuestion?.type === "splitsteal") {
          this.resolveSplitSteal();
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

    // Lineup mode: continuous multi-answer per round
    if (this.currentQuestion.type === "lineup") {
      this.handleLineupGuess(playerId, answerText);
      return;
    }

    // Liste mode: continuous multi-answer per round
    if (this.currentQuestion.type === "liste") {
      this.handleListeGuess(playerId, answerText);
      return;
    }

    if (this.answers.has(playerId)) return; // Already answered
    if (this.timeRemaining <= 0 && !this.petitBacGracePeriod) return; // Time's up (except during petit bac grace period)

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

    // Petit Bac: first submit triggers 3s countdown for everyone
    if (this.currentQuestion.type === "petitbac" && !this.petitBacStopTriggered) {
      this.petitBacStopTriggered = true;
      const stoppedByPlayer = this.room.players.find(p => p.id === playerId);
      this.io.to(this.room.code).emit("petitbac:stop_triggered", {
        playerId,
        playerName: stoppedByPlayer?.name || "?",
        countdown: 3,
      });
      this.petitBacStopTimer = setTimeout(() => {
        this.endRound();
      }, 3000);
      return;
    }

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

    // Clear petit bac stop timer if active
    if (this.petitBacStopTimer) {
      clearTimeout(this.petitBacStopTimer);
      this.petitBacStopTimer = null;
    }

    if (!this.currentQuestion) return;

    // Petit Bac: grace period for auto-submitted answers, then validation
    if (this.currentQuestion.type === "petitbac") {
      this.petitBacGracePeriod = true;
      setTimeout(() => {
        this.petitBacGracePeriod = false;
        this.startPetitBacValidation();
      }, 1500);
      return;
    }

    // GeoQuiz: enter host validation phase instead of auto-scoring
    if (this.currentQuestion.type === "geoquiz") {
      this.startGeoQuizValidation();
      return;
    }

    // Langue: enter host validation phase instead of auto-scoring
    if (this.currentQuestion.type === "langue") {
      this.startLangueValidation();
      return;
    }

    // Parcours: enter host validation phase instead of auto-scoring
    if (this.currentQuestion.type === "parcours") {
      this.startParcoursValidation();
      return;
    }

    // GuessGame: enter host validation phase instead of auto-scoring
    if (this.currentQuestion.type === "guessgame") {
      this.startGuessGameValidation();
      return;
    }

    // Consensus: enter host validation phase instead of auto-scoring
    if (this.currentQuestion.type === "consensus") {
      this.startConsensusValidation();
      return;
    }

    // Lettres: enter host validation phase
    if (this.currentQuestion.type === "lettres") {
      this.startLettresValidation();
      return;
    }

    // Liste: calculate scores based on found items
    if (this.currentQuestion.type === "liste") {
      this.finalizeListeRound();
      return;
    }

    // Lineup: show reveal screen first, then finalize scores
    if (this.currentQuestion.type === "lineup") {
      const q = this.currentQuestion as LineupQuestion;

      // Build per-player found counts for the reveal screen
      const revealScores = this.room.players.map((p) => ({
        playerId: p.id,
        foundCount: this.lineupFoundPlayers.get(p.id)?.size ?? 0,
      }));

      // Emit reveal with full match data
      this.io.to(this.room.code).emit("lineup:reveal", q.match, revealScores);

      // Auto-advance after 30 seconds
      this.lineupRevealTimer = setTimeout(() => {
        this.finalizeLineupRound();
      }, 30000);
      return;
    }

    // Calculate scores
    const results = this.calculateScores();

    // Update room status
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");

    // Update lose streaks
    this.updateLoseStreaks(results);

    // Send results
    this.io.to(this.room.code).emit("game:round_end", results);

    // Team round end processing
    if (this.currentTeams) {
      this.processTeamRoundEnd(results.scores);
    }

    // Update scores then auto-proceed (no leaderboard screen between rounds)
    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);
      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
  }

  /**
   * Update lose streaks based on round results
   */
  private updateLoseStreaks(results: RoundResult): void {
    for (const player of this.room.players) {
      const scoreEntry = results.scores.find((s) => s.playerId === player.id);
      if (scoreEntry && scoreEntry.points === 0) {
        player.loseStreak++;
      } else {
        player.loseStreak = 0;
      }
    }
  }

  /**
   * Update lose streaks for drawing mode (uses different score format)
   */
  private updateDrawingLoseStreaks(scores: { playerId: string; points: number }[]): void {
    for (const player of this.room.players) {
      const scoreEntry = scores.find((s) => s.playerId === player.id);
      if (scoreEntry && scoreEntry.points === 0) {
        player.loseStreak++;
      } else {
        player.loseStreak = 0;
      }
    }
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

    if (this.currentQuestion.type === "chrono") {
      return this.calculateChronoScores(correctAnswer, scores);
    }

    if (this.currentQuestion.type === "consensus") {
      return this.calculateConsensusScores(correctAnswer, scores);
    }

    if (this.currentQuestion.type === "dialed") {
      return this.calculateDialedScores(correctAnswer, scores);
    }

    let fastestCorrectTime = Infinity;

    // Process each answer
    for (const [playerId, answer] of this.answers) {
      const isCorrect = this.checkAnswer(answer.answer);
      answer.isCorrect = isCorrect;

      let points = 0;
      if (isCorrect) {
        points = this.currentQuestion.points;
        answer.points = points;

        // Track fastest correct answer for winner
        if ((answer.responseTime || Infinity) < fastestCorrectTime) {
          fastestCorrectTime = answer.responseTime || Infinity;
          winner = this.room.players.find((p) => p.id === playerId);
        }
      }

      // Update player score
      const updatedPlayer = this.updateScore(playerId, points);
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
        const updatedPlayer = this.updateScore(playerId, 0);
        if (updatedPlayer) {
          scores.push({ playerId, points: 0, total: updatedPlayer.score });
        }
        continue;
      }

      // Adaptive tolerance: lenient for cheap items, strict for expensive ones.
      // MAX_DEVIATION = 0.5 × (80 / price)^0.35, clamped between 0.20 and 0.65.
      // Examples: 15€ → 65% tolerance, 200€ → 35%, 500€ → 26%, 1500€ → 20%.
      const rawTolerance = 0.5 * Math.pow(80 / Math.max(realPrice, 1), 0.35);
      const MAX_DEVIATION = Math.min(0.65, Math.max(0.20, rawTolerance));
      const deviation = Math.abs(guess - realPrice) / realPrice;
      const proximityScore = deviation >= MAX_DEVIATION ? 0 : 1 - deviation / MAX_DEVIATION;
      const points = Math.round(q.points * proximityScore);

      // Consider "correct" if within 15% of real price
      answer.isCorrect = deviation <= 0.15;
      answer.points = points;

      // Track closest guess for winner
      if (deviation < closestDeviation) {
        closestDeviation = deviation;
        winner = this.room.players.find((p) => p.id === playerId);
      }

      const updatedPlayer = this.updateScore(playerId, points);
      if (updatedPlayer) {
        scores.push({ playerId, points, total: updatedPlayer.score });
      }
    }

    // Players who didn't answer
    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
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

      const points = Math.round(q.points * accuracy);
      answer.isCorrect = accuracy >= 0.85;
      answer.points = points;

      // Track best accuracy for winner
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        winner = this.room.players.find((p) => p.id === playerId);
      }

      const updatedPlayer = this.updateScore(playerId, points);
      if (updatedPlayer) {
        scores.push({ playerId, points, total: updatedPlayer.score });
      }
    }

    // Players who didn't answer
    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
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
   * Calculate proportional scores for chrono questions
   */
  private calculateChronoScores(
    correctAnswer: string,
    scores: { playerId: string; points: number; total: number }[]
  ): RoundResult {
    const q = this.currentQuestion as ChronoQuestion;
    const target = q.targetDuration;
    let winner: Player | undefined;
    let closestDeviation = Infinity;

    // First pass: find the closest player who stayed under/equal target (winner)
    let winnerId: string | undefined;
    for (const [playerId, answer] of this.answers) {
      const measured = parseInt(answer.answer, 10);
      if (isNaN(measured)) continue;

      // If exceeded target, skip this player (automatic 0 points)
      if (measured > target) continue;

      // Among valid answers, find the closest to target
      const deviation = Math.abs(measured - target);
      if (deviation < closestDeviation) {
        closestDeviation = deviation;
        winnerId = playerId;
      }
    }

    if (winnerId) {
      winner = this.room.players.find((p) => p.id === winnerId);
    }

    // Second pass: only players under/equal to target can win; exceeding target = 0 points
    for (const [playerId, answer] of this.answers) {
      const measured = parseInt(answer.answer, 10);

      let isWinner = false;
      let points = 0;

      if (isNaN(measured)) {
        // Invalid answer
        answer.isCorrect = false;
        answer.points = 0;
      } else if (measured > target) {
        // Exceeded target: automatic 0 points
        answer.isCorrect = false;
        answer.points = 0;
      } else {
        // Valid answer (under/equal target): check if winner
        isWinner = playerId === winnerId;
        points = isWinner ? q.points : 0;
        answer.isCorrect = isWinner;
        answer.points = points;
      }

      const updatedPlayer = this.updateScore(playerId, points);
      if (updatedPlayer) {
        scores.push({ playerId, points, total: updatedPlayer.score });
      }
    }

    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
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
   * Calculate color proximity scores for dialed questions.
   * Uses CIE76 Delta-E in Lab color space for perceptual accuracy.
   * Max score at deltaE=0, 0 score at deltaE>=80.
   */
  private calculateDialedScores(
    correctAnswer: string,
    scores: { playerId: string; points: number; total: number }[]
  ): RoundResult {
    const q = this.currentQuestion as DialedQuestion;
    const targetLab = GameEngine.hslToLab(q.targetH, q.targetS, q.targetL);
    let winner: Player | undefined;
    let bestDeltaE = Infinity;

    for (const [playerId, answer] of this.answers) {
      let h: number, s: number, l: number;
      try {
        const parsed = JSON.parse(answer.answer);
        h = parsed.h;
        s = parsed.s;
        l = parsed.l;
      } catch {
        answer.isCorrect = false;
        answer.points = 0;
        const updatedPlayer = this.updateScore(playerId, 0);
        if (updatedPlayer) {
          scores.push({ playerId, points: 0, total: updatedPlayer.score });
        }
        continue;
      }

      const guessLab = GameEngine.hslToLab(h, s, l);
      const deltaE = Math.sqrt(
        (targetLab.L - guessLab.L) ** 2 +
        (targetLab.a - guessLab.a) ** 2 +
        (targetLab.b - guessLab.b) ** 2
      );

      // Score: linear from 1000 (deltaE=0) to 0 (deltaE>=80)
      const MAX_DELTA = 80;
      const proximityScore = deltaE >= MAX_DELTA ? 0 : 1 - deltaE / MAX_DELTA;
      const points = Math.round(q.points * proximityScore);

      answer.isCorrect = deltaE <= 10; // "correct" if very close
      answer.points = points;

      if (deltaE < bestDeltaE) {
        bestDeltaE = deltaE;
        winner = this.room.players.find((p) => p.id === playerId);
      }

      const updatedPlayer = this.updateScore(playerId, points);
      if (updatedPlayer) {
        scores.push({ playerId, points, total: updatedPlayer.score });
      }
    }

    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
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
   * Convert HSL to CIE Lab color space for perceptual comparison.
   */
  private static hslToLab(h: number, s: number, l: number): { L: number; a: number; b: number } {
    // HSL → RGB
    const sn = s / 100;
    const ln = l / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ln - c / 2;
    let r1: number, g1: number, b1: number;
    if (h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const r = r1 + m;
    const g = g1 + m;
    const b = b1 + m;

    // RGB → XYZ (sRGB D65)
    const linearize = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const rl = linearize(r);
    const gl = linearize(g);
    const bl = linearize(b);
    const X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
    const Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
    const Z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;

    // XYZ → Lab (D65 white point)
    const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
    const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (903.3 * t + 16) / 116;
    const fx = f(X / Xn);
    const fy = f(Y / Yn);
    const fz = f(Z / Zn);
    return {
      L: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  }

  /**
   * Calculate consensus scores — winner-takes-all for the largest answer group
   */
  private calculateConsensusScores(
    _correctAnswer: string,
    scores: { playerId: string; points: number; total: number }[]
  ): RoundResult {
    const q = this.currentQuestion as ConsensusQuestion;
    let winner: Player | undefined;

    // Normalize and group answers
    const groups = new Map<string, { playerIds: string[]; rawAnswer: string }>();
    for (const [playerId, answer] of this.answers) {
      const normalized = GameEngine.normalizeForComparison(answer.answer);
      if (!normalized) continue;

      if (!groups.has(normalized)) {
        groups.set(normalized, { playerIds: [], rawAnswer: answer.answer.trim() });
      }
      groups.get(normalized)!.playerIds.push(playerId);
    }

    // Find largest group(s)
    let maxGroupSize = 0;
    for (const [, group] of groups) {
      if (group.playerIds.length > maxGroupSize) {
        maxGroupSize = group.playerIds.length;
      }
    }

    // All groups with max size win (handles ties)
    const winningPlayerIds = new Set<string>();
    let winningAnswer = "";
    let earliestWinnerTime = Infinity;

    for (const [, group] of groups) {
      if (group.playerIds.length === maxGroupSize && maxGroupSize > 0) {
        for (const pid of group.playerIds) {
          winningPlayerIds.add(pid);
        }
        if (!winningAnswer) winningAnswer = group.rawAnswer;
      }
    }

    // Score players
    for (const [playerId, answer] of this.answers) {
      const isWinner = winningPlayerIds.has(playerId);
      const points = isWinner ? q.points : 0;
      answer.isCorrect = isWinner;
      answer.points = points;

      // Track fastest winner
      if (isWinner && (answer.responseTime || Infinity) < earliestWinnerTime) {
        earliestWinnerTime = answer.responseTime || Infinity;
        winner = this.room.players.find((p) => p.id === playerId);
      }

      const updatedPlayer = this.updateScore(playerId, points);
      if (updatedPlayer) {
        scores.push({ playerId, points, total: updatedPlayer.score });
      }
    }

    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
        scores.push({ playerId: player.id, points: 0, total: player.score });
      }
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: Array.from(this.answers.values()),
      correctAnswer: winningAnswer || q.prompt,
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
      case "geoquiz":
        return (this.currentQuestion as GeoQuizQuestion).city;
      case "langue": {
        const q = this.currentQuestion as LangueQuestion;
        return `${q.language} — ${q.meaning}`;
      }
      case "maths": {
        const q = this.currentQuestion as MathsQuestion;
        return q.options[q.correctIndex];
      }
      case "guessgame":
        return (this.currentQuestion as GuessGameQuestion).gameTitle;
      case "lineup": {
        const q = this.currentQuestion as LineupQuestion;
        return `${q.match.team1.name} vs ${q.match.team2.name}`;
      }
      case "jerseynumber": {
        const q = this.currentQuestion as JerseyNumberQuestion;
        return `N°${q.correctNumber}`;
      }
      case "futcard":
        return (this.currentQuestion as FutCardQuestion).playerName;
      case "chrono":
        return (this.currentQuestion as ChronoQuestion).label;
      case "consensus":
        return (this.currentQuestion as ConsensusQuestion).prompt;
      case "liste":
        return (this.currentQuestion as ListeQuestion).title;
      case "dialed": {
        const q = this.currentQuestion as DialedQuestion;
        return `hsl(${q.targetH}, ${q.targetS}%, ${q.targetL}%)`;
      }
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
      case "geoquiz":
        // GeoQuiz scoring is handled manually by host validation
        return false;
      case "langue":
        // Langue scoring is handled manually by host validation
        return false;
      case "parcours":
        // Parcours scoring is handled manually by host validation
        return false;
      case "maths": {
        const q = this.currentQuestion as MathsQuestion;
        const correctOption = q.options[q.correctIndex].toLowerCase();
        return (
          normalizedAnswer === correctOption ||
          normalizedAnswer === String(q.correctIndex)
        );
      }
      case "guessgame": {
        const q = this.currentQuestion as GuessGameQuestion;
        const normalizedInput = GameEngine.normalizeForComparison(answer);
        return q.acceptedAnswers.some(
          (accepted) => GameEngine.normalizeForComparison(accepted) === normalizedInput
        );
      }
      case "lineup":
        // Lineup scoring is handled in handleLineupGuess
        return false;
      case "jerseynumber": {
        const q = this.currentQuestion as JerseyNumberQuestion;
        const guess = parseInt(answer.trim(), 10);
        return !isNaN(guess) && guess === q.correctNumber;
      }
      case "futcard": {
        const q = this.currentQuestion as FutCardQuestion;
        const normalizedInput = GameEngine.normalizeForComparison(answer);
        return q.acceptedAnswers.some(
          (accepted) => GameEngine.normalizeForComparison(accepted) === normalizedInput
        );
      }
      case "chrono":
        return false; // Handled in calculateChronoScores
      case "consensus":
        return false; // Handled in calculateConsensusScores
      case "liste":
        return false; // Handled in handleListeGuess
      case "dialed":
        return false; // Handled in calculateDialedScores
      default:
        return false;
    }
  }

  // ==========================================
  // LINEUP METHODS
  // ==========================================

  /**
   * Handle a lineup guess: check if the guessed name matches any unfound player
   */
  private handleLineupGuess(playerId: string, guess: string): void {
    if (!this.currentQuestion || this.currentQuestion.type !== "lineup") return;
    if (this.timeRemaining <= 0) return;

    const match = (this.currentQuestion as LineupQuestion).match;
    const allPlayers = [...match.team1.players, ...match.team2.players];

    // Initialize tracking for this player if needed
    if (!this.lineupFoundPlayers.has(playerId)) {
      this.lineupFoundPlayers.set(playerId, new Set());
    }
    const found = this.lineupFoundPlayers.get(playerId)!;

    const normalizedGuess = GameEngine.normalizeForComparison(guess);
    if (normalizedGuess.length < 2) return; // Too short

    // Check against all 22 players
    let matchedIndex = -1;
    for (let i = 0; i < allPlayers.length; i++) {
      if (found.has(i)) continue; // Already found by this player

      const p = allPlayers[i];
      // Check main name and all alternatives
      const allNames = [p.name, ...p.alt];
      for (const name of allNames) {
        const normalizedName = GameEngine.normalizeForComparison(name);
        // Exact match
        if (normalizedName === normalizedGuess) {
          matchedIndex = i;
          break;
        }
        // Last-name match: "Messi" matches "Lionel Messi", "De Rossi" matches "Daniele De Rossi"
        // Guess must be ≥3 chars and match the end of the name at a word boundary
        if (normalizedGuess.length >= 3 && normalizedName.endsWith(normalizedGuess) &&
            normalizedName[normalizedName.length - normalizedGuess.length - 1] === " ") {
          matchedIndex = i;
          break;
        }
      }
      if (matchedIndex >= 0) break;
    }

    if (matchedIndex >= 0) {
      found.add(matchedIndex);
      const teamSide: 1 | 2 = matchedIndex < match.team1.players.length ? 1 : 2;
      const playerIndex = teamSide === 1 ? matchedIndex : matchedIndex - match.team1.players.length;
      const displayName = allPlayers[matchedIndex].name;

      // Track global found
      if (!this.lineupGlobalFound.has(matchedIndex)) {
        this.lineupGlobalFound.set(matchedIndex, new Set());
      }
      this.lineupGlobalFound.get(matchedIndex)!.add(playerId);

      // Award points immediately
      const points = this.currentQuestion.points;
      this.updateScore(playerId, points);

      // Send result to all players
      const result: LineupGuessResult = {
        playerId,
        correct: true,
        teamSide,
        playerIndex,
        displayName,
        foundCount: found.size,
        totalPlayers: allPlayers.length,
      };
      this.io.to(this.room.code).emit("lineup:guess_result", result);
    } else {
      // Wrong guess — only notify the guesser
      const result: LineupGuessResult = {
        playerId,
        correct: false,
        foundCount: found.size,
        totalPlayers: allPlayers.length,
      };
      // Emit to all (client filters display)
      this.io.to(this.room.code).emit("lineup:guess_result", result);
    }
  }

  /**
   * Calculate lineup scores at end of round
   */
  private calculateLineupScores(): RoundResult {
    const q = this.currentQuestion as LineupQuestion;
    const allPlayers = [...q.match.team1.players, ...q.match.team2.players];
    const scores: { playerId: string; points: number; total: number }[] = [];
    let winner: Player | undefined;
    let bestCount = 0;

    // Compute exclusive finds: lineup players found by only 1 person
    const exclusiveFindsByPlayer = new Map<string, number>();
    for (const [, finders] of this.lineupGlobalFound) {
      if (finders.size === 1) {
        const soloFinder = finders.values().next().value!;
        exclusiveFindsByPlayer.set(soloFinder, (exclusiveFindsByPlayer.get(soloFinder) || 0) + 1);
      }
    }

    for (const player of this.room.players) {
      const found = this.lineupFoundPlayers.get(player.id);
      const foundCount = found ? found.size : 0;
      const exclusiveCount = exclusiveFindsByPlayer.get(player.id) || 0;

      // Award x2 bonus for exclusive finds (extra points on top of what was already given)
      const bonusPoints = exclusiveCount * q.points;
      if (bonusPoints > 0) {
        this.updateScore(player.id, bonusPoints);
      }

      const totalPoints = foundCount * q.points + bonusPoints;
      if (foundCount > bestCount) {
        bestCount = foundCount;
        winner = player;
      }
      scores.push({
        playerId: player.id,
        points: totalPoints,
        total: player.score,
      });
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: [],
      correctAnswer: `${allPlayers.length} joueurs`,
      winner,
      scores,
    };
  }

  /**
   * Finalize the lineup round after reveal screen
   */
  private finalizeLineupRound(): void {
    if (this.lineupRevealTimer) {
      clearTimeout(this.lineupRevealTimer);
      this.lineupRevealTimer = null;
    }

    const results = this.calculateLineupScores();
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
    this.updateLoseStreaks(results);
    this.io.to(this.room.code).emit("game:round_end", results);
    this.lineupFoundPlayers.clear();
    this.lineupGlobalFound.clear();

    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);
      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
  }

  /**
   * Host skips the lineup reveal screen
   */
  public skipLineupReveal(): void {
    if (this.lineupRevealTimer) {
      this.finalizeLineupRound();
    }
  }

  // ==========================================
  // LISTE MODE METHODS
  // ==========================================

  /**
   * Handle a Liste guess: check if the guessed text matches any unfound item
   */
  private handleListeGuess(playerId: string, guess: string): void {
    if (!this.currentQuestion || this.currentQuestion.type !== "liste") return;
    if (this.listeFinishedPlayers.has(playerId)) return;
    if (this.timeRemaining <= 0) return;

    const q = this.currentQuestion as ListeQuestion;
    const normalizedGuess = GameEngine.normalizeForComparison(guess);
    if (normalizedGuess.length < 2) return;

    // Get this player's found items
    if (!this.listeFoundItems.has(playerId)) {
      this.listeFoundItems.set(playerId, new Set());
    }
    const playerFound = this.listeFoundItems.get(playerId)!;

    // Check against all items
    let matchedIndex = -1;
    for (let i = 0; i < q.items.length; i++) {
      if (playerFound.has(i)) continue; // Already found by this player

      const item = q.items[i];
      const allNames = [item.answer, ...item.aliases];
      for (const name of allNames) {
        const normalizedName = GameEngine.normalizeForComparison(name);
        // Exact match
        if (normalizedName === normalizedGuess) {
          matchedIndex = i;
          break;
        }
        // Last-name match for player names (3+ chars, word boundary)
        if (normalizedGuess.length >= 3 && normalizedName.endsWith(normalizedGuess) &&
            normalizedName[normalizedName.length - normalizedGuess.length - 1] === " ") {
          matchedIndex = i;
          break;
        }
      }
      if (matchedIndex >= 0) break;
    }

    if (matchedIndex >= 0) {
      playerFound.add(matchedIndex);

      // Track global first finder
      if (!this.listeGlobalFound.has(matchedIndex)) {
        this.listeGlobalFound.set(matchedIndex, playerId);
      }

      // Emit item found to all
      this.io.to(this.room.code).emit("liste:item_found", {
        playerId,
        itemIndex: matchedIndex,
        answer: q.items[matchedIndex].answer,
      });
    }
  }

  /**
   * Player clicks "J'ai fini" — finish early if unanimous
   */
  submitListeFinish(playerId: string): void {
    if (!this.currentQuestion || this.currentQuestion.type !== "liste") return;
    if (this.listeFinishedPlayers.has(playerId)) return;

    this.listeFinishedPlayers.add(playerId);

    const activePlayers = this.getActivePlayers();
    const finishedCount = this.listeFinishedPlayers.size;
    const totalPlayers = activePlayers.length;

    // Notify all players
    this.io.to(this.room.code).emit("liste:player_finished", {
      playerId,
      finishedCount,
      totalPlayers,
    });

    // If everyone finished, end the round
    if (finishedCount >= totalPlayers) {
      this.endRound();
    }
  }

  /**
   * Finalize the Liste round: calculate scores and emit results
   */
  private finalizeListeRound(): void {
    this.stopTimer();
    if (!this.currentQuestion || this.currentQuestion.type !== "liste") return;

    const q = this.currentQuestion as ListeQuestion;
    const totalItems = q.items.length;
    const basePoints = q.points; // Already clamped: max(150, min(300, items*10))
    const pointsPerItem = basePoints / totalItems;
    const COMPLETION_BONUS = 100;

    const playerResults: ListeRoundResult["playerResults"] = [];

    for (const player of this.room.players) {
      const found = this.listeFoundItems.get(player.id) || new Set<number>();
      const foundCount = found.size;
      const itemPoints = Math.round(pointsPerItem * foundCount);
      const isComplete = foundCount >= totalItems;
      const totalPoints = itemPoints + (isComplete ? COMPLETION_BONUS : 0);

      // Update player score
      const updatedPlayer = this.updateScore(player.id, totalPoints);

      playerResults.push({
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        foundCount,
        points: totalPoints,
        total: updatedPlayer?.score || player.score,
        foundItems: Array.from(found),
        completionBonus: isComplete,
      });
    }

    // Sort by points desc
    playerResults.sort((a, b) => b.points - a.points);

    const listeResult: ListeRoundResult = {
      roundNumber: this.currentRound,
      quizTitle: q.title,
      items: q.items,
      playerResults,
    };

    // Also build a standard RoundResult for compatibility
    const scores = playerResults.map(r => ({
      playerId: r.playerId,
      points: r.points,
      total: r.total,
    }));

    const roundResult: RoundResult = {
      roundNumber: this.currentRound,
      question: q,
      answers: [],
      correctAnswer: q.title,
      winner: playerResults[0] ? this.room.players.find(p => p.id === playerResults[0].playerId) : undefined,
      scores,
    };

    // Update lose streaks
    this.updateLoseStreaks(roundResult);

    // Emit both custom result and standard round_end
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
    this.io.to(this.room.code).emit("liste:round_end", listeResult);
    this.io.to(this.room.code).emit("game:round_end", roundResult);

    // Team round end processing
    if (this.currentTeams) {
      this.processTeamRoundEnd(scores);
    }

    // Reset liste state
    this.listeFoundItems.clear();
    this.listeGlobalFound.clear();
    this.listeFinishedPlayers.clear();

    // Auto-proceed
    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);
      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
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
    this.stopTimer(); // Stop timer immediately when validation is submitted

    const q = this.currentQuestion as PetitBacQuestion;
    const results = this.calculatePetitBacScores(q, validation);

    // Broadcast validated answers to everyone before round_end
    this.io.to(this.room.code).emit("petitbac:validation_result", validation);

    // Update lose streaks
    this.updateLoseStreaks(results);

    // Update room status
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");

    // Send results
    this.io.to(this.room.code).emit("game:round_end", results);

    // Team round end processing
    if (this.currentTeams) {
      this.processTeamRoundEnd(results.scores);
    }

    // Show leaderboard after a delay
    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
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

        totalPoints += 30;
      }

      if (answer) {
        answer.points = totalPoints;
        answer.isCorrect = totalPoints > 0;
      }

      const updatedPlayer = this.updateScore(player.id, totalPoints);
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
  // GEOQUIZ METHODS
  // ==========================================

  /**
   * Player uses hint — reveal the country, halve their points
   */
  useGeoQuizHint(playerId: string): void {
    if (!this.currentQuestion || this.currentQuestion.type !== "geoquiz") return;
    if (this.geoQuizHintUsers.has(playerId)) return;

    this.geoQuizHintUsers.add(playerId);
    const q = this.currentQuestion as GeoQuizQuestion;

    // Send hint only to this player
    const socketId = this.roomManager.getSocketIdFromPlayerId(playerId);
    if (socketId) {
      this.io.to(socketId).emit("geoquiz:hint_revealed", q.hint || q.country);
    }
  }

  /**
   * Start GeoQuiz validation phase: collect answers and send to host
   */
  private startGeoQuizValidation(): void {
    this.geoQuizValidating = true;
    this.geoQuizDecisions.clear();
    const q = this.currentQuestion as GeoQuizQuestion;
    const activePlayers = this.getActivePlayers();

    // Ensure all players have an answer entry
    for (const player of activePlayers) {
      if (!this.answers.has(player.id)) {
        this.answers.set(player.id, {
          playerId: player.id,
          questionId: q.id,
          answer: "",
          timestamp: Date.now(),
        });
      }
    }

    this.geoQuizPlayerAnswers = activePlayers.map((player) => {
      const answer = this.answers.get(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        answer: answer?.answer || "",
        usedHint: this.geoQuizHintUsers.has(player.id),
      };
    });

    this.io.to(this.room.code).emit("geoquiz:validation_start", {
      city: q.city,
      country: q.country,
      imageUrl: q.imageUrl,
      playerAnswers: this.geoQuizPlayerAnswers,
    });

    // Auto-validation timeout: 60 seconds for step-by-step review
    this.geoQuizAutoValidationTimer = setTimeout(() => {
      if (this.geoQuizValidating) {
        // Auto-validate remaining un-reviewed answers
        for (const pa of this.geoQuizPlayerAnswers) {
          if (this.geoQuizDecisions.has(pa.playerId)) continue;
          if (!pa.answer) {
            this.geoQuizDecisions.set(pa.playerId, false);
            continue;
          }
          const normalized = GameEngine.normalizeForComparison(pa.answer);
          const isMatch = q.acceptedAnswers.some(
            (accepted) => GameEngine.normalizeForComparison(accepted) === normalized
          );
          this.geoQuizDecisions.set(pa.playerId, isMatch);
          this.io.to(this.room.code).emit("geoquiz:answer_result", {
            playerId: pa.playerId,
            playerName: pa.playerName,
            playerAvatar: pa.playerAvatar,
            answer: pa.answer,
            usedHint: pa.usedHint,
            accepted: isMatch,
          });
        }
        // Finalize after a short delay
        setTimeout(() => {
          this.finalizeGeoQuizFromDecisions();
        }, 1500);
      }
    }, 60000);
  }

  /**
   * Host validates a single player's answer (step-by-step)
   */
  validateSingleGeoQuizAnswer(playerId: string, accepted: boolean): void {
    if (!this.geoQuizValidating || !this.currentQuestion) return;
    if (this.geoQuizDecisions.has(playerId)) return;

    this.geoQuizDecisions.set(playerId, accepted);

    // Find player data
    const pa = this.geoQuizPlayerAnswers.find((p) => p.playerId === playerId);
    if (!pa) return;

    // Broadcast result to all players
    this.io.to(this.room.code).emit("geoquiz:answer_result", {
      playerId: pa.playerId,
      playerName: pa.playerName,
      playerAvatar: pa.playerAvatar,
      answer: pa.answer,
      usedHint: pa.usedHint,
      accepted,
    });

    // Check if all players with answers have been reviewed
    const playersToReview = this.geoQuizPlayerAnswers.filter(
      (p) => p.answer.trim().length > 0
    );
    const allReviewed = playersToReview.every((p) =>
      this.geoQuizDecisions.has(p.playerId)
    );

    if (allReviewed) {
      // Also mark empty-answer players as rejected
      for (const p of this.geoQuizPlayerAnswers) {
        if (!this.geoQuizDecisions.has(p.playerId)) {
          this.geoQuizDecisions.set(p.playerId, false);
        }
      }
      // Finalize after brief delay for last animation
      setTimeout(() => {
        this.finalizeGeoQuizFromDecisions();
      }, 2000);
    }
  }

  /**
   * Finalize GeoQuiz scoring from accumulated per-answer decisions
   */
  private finalizeGeoQuizFromDecisions(): void {
    if (!this.geoQuizValidating) return;

    const validatedPlayerIds = Array.from(this.geoQuizDecisions.entries())
      .filter(([, accepted]) => accepted)
      .map(([id]) => id);

    this.submitGeoQuizValidation({ validatedPlayerIds });
  }

  /**
   * Host submits GeoQuiz validation results
   */
  submitGeoQuizValidation(validation: GeoQuizValidationSubmission): void {
    if (!this.currentQuestion || !this.geoQuizValidating) return;
    this.geoQuizValidating = false;

    // Clear auto-validation timer
    if (this.geoQuizAutoValidationTimer) {
      clearTimeout(this.geoQuizAutoValidationTimer);
      this.geoQuizAutoValidationTimer = null;
    }

    const q = this.currentQuestion as GeoQuizQuestion;
    const results = this.calculateGeoQuizScores(q, validation);

    // Broadcast validation result
    this.io.to(this.room.code).emit("geoquiz:validation_result", validation);

    // Update lose streaks
    this.updateLoseStreaks(results);

    // Update room status
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");

    // Send results
    this.io.to(this.room.code).emit("game:round_end", results);

    // Team round end processing
    if (this.currentTeams) {
      this.processTeamRoundEnd(results.scores);
    }

    // Reset hint users for next round
    this.geoQuizHintUsers.clear();

    // Show leaderboard after delay
    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
  }

  /**
   * Calculate GeoQuiz scores based on host validation
   * - Validated: base points + speed bonus, /2 if hint used
   * - Rejected/empty: 0 points
   */
  private calculateGeoQuizScores(
    q: GeoQuizQuestion,
    validation: GeoQuizValidationSubmission
  ): RoundResult {
    const scores: { playerId: string; points: number; total: number }[] = [];
    let bestPoints = 0;
    let winner: Player | undefined;

    for (const player of this.room.players) {
      const answer = this.answers.get(player.id);
      const isValidated = validation.validatedPlayerIds.includes(player.id);

      let points = 0;
      if (isValidated && answer) {
        points = q.points;

        // Hint penalty: halve points
        if (this.geoQuizHintUsers.has(player.id)) {
          points = Math.floor(points / 2);
        }
      }

      if (answer) {
        answer.points = points;
        answer.isCorrect = isValidated;
      }

      const updatedPlayer = this.updateScore(player.id, points);
      scores.push({
        playerId: player.id,
        points,
        total: updatedPlayer?.score || player.score,
      });

      if (points > bestPoints) {
        bestPoints = points;
        winner = player;
      }
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: Array.from(this.answers.values()),
      correctAnswer: q.city,
      winner,
      scores,
    };
  }

  // ==========================================
  // LANGUE METHODS
  // ==========================================

  private startLangueValidation(): void {
    this.langueValidating = true;
    this.langueDecisions.clear();
    const q = this.currentQuestion as LangueQuestion;
    const activePlayers = this.getActivePlayers();

    // Ensure all players have an answer entry
    for (const player of activePlayers) {
      if (!this.answers.has(player.id)) {
        this.answers.set(player.id, {
          playerId: player.id,
          questionId: q.id,
          answer: JSON.stringify({ language: "", meaning: "" }),
          timestamp: Date.now(),
        });
      }
    }

    this.languePlayerAnswers = activePlayers.map((player) => {
      const answer = this.answers.get(player.id);
      let languageAnswer = "";
      let meaningAnswer = "";
      if (answer) {
        try {
          const parsed = JSON.parse(answer.answer);
          languageAnswer = parsed.language || "";
          meaningAnswer = parsed.meaning || "";
        } catch {
          languageAnswer = answer.answer || "";
        }
      }
      return {
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        languageAnswer,
        meaningAnswer,
      };
    });

    this.io.to(this.room.code).emit("langue:validation_start", {
      word: q.targetWord || q.word || "",
      sentence: q.sentence,
      sentenceTransliteration: q.sentenceTransliteration,
      targetWord: q.targetWord || q.word || "",
      targetWordTransliteration: q.targetWordTransliteration,
      script: q.script || "latin",
      correctLanguage: q.language,
      correctMeaning: q.meaning,
      playerAnswers: this.languePlayerAnswers,
    });

    // Auto-validation timeout: 60 seconds
    this.langueAutoValidationTimer = setTimeout(() => {
      if (this.langueValidating) {
        for (const pa of this.languePlayerAnswers) {
          if (this.langueDecisions.has(pa.playerId)) continue;
          if (!pa.languageAnswer && !pa.meaningAnswer) {
            this.langueDecisions.set(pa.playerId, { languageCorrect: false, meaningCorrect: false });
            continue;
          }
          const langNorm = GameEngine.normalizeForComparison(pa.languageAnswer);
          const meaningNorm = GameEngine.normalizeForComparison(pa.meaningAnswer);
          const languageCorrect = q.acceptedLanguages.some(
            (accepted) => GameEngine.normalizeForComparison(accepted) === langNorm
          );
          const meaningCorrect = q.acceptedMeanings.some(
            (accepted) => GameEngine.normalizeForComparison(accepted) === meaningNorm
          );
          this.langueDecisions.set(pa.playerId, { languageCorrect, meaningCorrect });
          this.io.to(this.room.code).emit("langue:answer_result", {
            playerId: pa.playerId,
            playerName: pa.playerName,
            playerAvatar: pa.playerAvatar,
            languageAnswer: pa.languageAnswer,
            meaningAnswer: pa.meaningAnswer,
            languageCorrect,
            meaningCorrect,
          });
        }
        setTimeout(() => {
          this.finalizeLangueFromDecisions();
        }, 1500);
      }
    }, 60000);
  }

  validateSingleLangueAnswer(playerId: string, languageCorrect: boolean, meaningCorrect: boolean): void {
    if (!this.langueValidating || !this.currentQuestion) return;
    if (this.langueDecisions.has(playerId)) return;

    this.langueDecisions.set(playerId, { languageCorrect, meaningCorrect });

    const pa = this.languePlayerAnswers.find((p) => p.playerId === playerId);
    if (!pa) return;

    this.io.to(this.room.code).emit("langue:answer_result", {
      playerId: pa.playerId,
      playerName: pa.playerName,
      playerAvatar: pa.playerAvatar,
      languageAnswer: pa.languageAnswer,
      meaningAnswer: pa.meaningAnswer,
      languageCorrect,
      meaningCorrect,
    });

    // Check if all players with answers have been reviewed
    const playersToReview = this.languePlayerAnswers.filter(
      (p) => (p.languageAnswer || "").trim().length > 0 || (p.meaningAnswer || "").trim().length > 0
    );
    const allReviewed = playersToReview.every((p) =>
      this.langueDecisions.has(p.playerId)
    );

    if (allReviewed) {
      for (const p of this.languePlayerAnswers) {
        if (!this.langueDecisions.has(p.playerId)) {
          this.langueDecisions.set(p.playerId, { languageCorrect: false, meaningCorrect: false });
        }
      }
      setTimeout(() => {
        this.finalizeLangueFromDecisions();
      }, 2000);
    }
  }

  private finalizeLangueFromDecisions(): void {
    if (!this.langueValidating) return;

    const results: LangueValidationSubmission["results"] = Array.from(this.langueDecisions.entries())
      .map(([playerId, decision]) => ({
        playerId,
        languageCorrect: decision.languageCorrect,
        meaningCorrect: decision.meaningCorrect,
      }));

    this.submitLangueValidation({ results });
  }

  submitLangueValidation(validation: LangueValidationSubmission): void {
    if (!this.currentQuestion || !this.langueValidating) return;
    this.langueValidating = false;

    if (this.langueAutoValidationTimer) {
      clearTimeout(this.langueAutoValidationTimer);
      this.langueAutoValidationTimer = null;
    }

    const q = this.currentQuestion as LangueQuestion;
    const results = this.calculateLangueScores(q, validation);

    this.io.to(this.room.code).emit("langue:validation_result", validation);

    // Update lose streaks
    this.updateLoseStreaks(results);

    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");

    this.io.to(this.room.code).emit("game:round_end", results);

    // Team round end processing
    if (this.currentTeams) {
      this.processTeamRoundEnd(results.scores);
    }

    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
  }

  private calculateLangueScores(
    q: LangueQuestion,
    validation: LangueValidationSubmission
  ): RoundResult {
    const scores: { playerId: string; points: number; total: number }[] = [];
    let bestPoints = 0;
    let winner: Player | undefined;

    for (const player of this.room.players) {
      const answer = this.answers.get(player.id);
      const playerResult = validation.results.find((r) => r.playerId === player.id);

      let points = 0;
      const langCorrect = playerResult?.languageCorrect || false;
      const meaningCorrect = playerResult?.meaningCorrect || false;
      const atLeastOneCorrect = langCorrect || meaningCorrect;

      if (langCorrect) points += 100;
      if (meaningCorrect) points += 100;

      if (answer) {
        answer.points = points;
        answer.isCorrect = atLeastOneCorrect;
      }

      const updatedPlayer = this.updateScore(player.id, points);
      scores.push({
        playerId: player.id,
        points,
        total: updatedPlayer?.score || player.score,
      });

      if (points > bestPoints) {
        bestPoints = points;
        winner = player;
      }
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: Array.from(this.answers.values()),
      correctAnswer: `${q.language} — ${q.meaning}`,
      winner,
      scores,
    };
  }

  // ==========================================
  // GUESS GAME VALIDATION METHODS
  // ==========================================

  // ==========================================
  // PARCOURS VALIDATION METHODS
  // ==========================================

  private startParcoursValidation(): void {
    this.parcoursValidating = true;
    this.parcoursDecisions.clear();
    const q = this.currentQuestion as ParcoursQuestion;
    const activePlayers = this.getActivePlayers();

    // Ensure all players have an answer entry
    for (const player of activePlayers) {
      if (!this.answers.has(player.id)) {
        this.answers.set(player.id, {
          playerId: player.id,
          questionId: q.id,
          answer: "",
          timestamp: Date.now(),
        });
      }
    }

    this.parcoursPlayerAnswers = activePlayers.map((player) => {
      const answer = this.answers.get(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        answer: answer?.answer || "",
      };
    });

    this.io.to(this.room.code).emit("parcours:validation_start", {
      clubs: q.clubs,
      playerAnswers: this.parcoursPlayerAnswers,
      correctAnswer: q.playerName,
    });

    // Auto-validation timeout: 60 seconds
    this.parcoursAutoValidationTimer = setTimeout(() => {
      if (this.parcoursValidating) {
        for (const pa of this.parcoursPlayerAnswers) {
          if (this.parcoursDecisions.has(pa.playerId)) continue;
          if (!pa.answer) {
            this.parcoursDecisions.set(pa.playerId, false);
            continue;
          }
          const normalized = GameEngine.normalizeForComparison(pa.answer);
          const isMatch = q.acceptedAnswers.some(
            (accepted) => GameEngine.normalizeForComparison(accepted) === normalized
          );
          this.parcoursDecisions.set(pa.playerId, isMatch);
          this.io.to(this.room.code).emit("parcours:answer_result", {
            playerId: pa.playerId,
            playerName: pa.playerName,
            playerAvatar: pa.playerAvatar,
            answer: pa.answer,
            accepted: isMatch,
          });
        }
        setTimeout(() => {
          this.finalizeParcoursFromDecisions();
        }, 1500);
      }
    }, 60000);
  }

  validateSingleParcoursAnswer(playerId: string, accepted: boolean): void {
    if (!this.parcoursValidating || !this.currentQuestion) return;
    if (this.parcoursDecisions.has(playerId)) return;

    this.parcoursDecisions.set(playerId, accepted);

    const pa = this.parcoursPlayerAnswers.find((p) => p.playerId === playerId);
    if (!pa) return;

    this.io.to(this.room.code).emit("parcours:answer_result", {
      playerId: pa.playerId,
      playerName: pa.playerName,
      playerAvatar: pa.playerAvatar,
      answer: pa.answer,
      accepted,
    });

    const playersToReview = this.parcoursPlayerAnswers.filter(
      (p) => p.answer.trim().length > 0
    );
    const allReviewed = playersToReview.every((p) =>
      this.parcoursDecisions.has(p.playerId)
    );

    if (allReviewed) {
      for (const p of this.parcoursPlayerAnswers) {
        if (!this.parcoursDecisions.has(p.playerId)) {
          this.parcoursDecisions.set(p.playerId, false);
        }
      }
      setTimeout(() => {
        this.finalizeParcoursFromDecisions();
      }, 2000);
    }
  }

  private finalizeParcoursFromDecisions(): void {
    if (!this.parcoursValidating) return;

    const validatedPlayerIds = Array.from(this.parcoursDecisions.entries())
      .filter(([, accepted]) => accepted)
      .map(([id]) => id);

    this.submitParcoursValidation({ validatedPlayerIds });
  }

  submitParcoursValidation(validation: ParcoursValidationSubmission): void {
    if (!this.currentQuestion || !this.parcoursValidating) return;
    this.parcoursValidating = false;

    if (this.parcoursAutoValidationTimer) {
      clearTimeout(this.parcoursAutoValidationTimer);
      this.parcoursAutoValidationTimer = null;
    }

    const q = this.currentQuestion as ParcoursQuestion;
    const scores: { playerId: string; points: number; total: number }[] = [];
    let bestPoints = 0;
    let winner: Player | undefined;

    for (const player of this.room.players) {
      const answer = this.answers.get(player.id);
      const isValidated = validation.validatedPlayerIds.includes(player.id);

      let points = 0;
      if (isValidated && answer) {
        points = q.points;

        // Speed bonus: faster responses get more points
        if (answer.responseTime !== undefined) {
          const speedBonus = Math.max(0, Math.round((q.timeLimit - answer.responseTime) / q.timeLimit * 50));
          points += speedBonus;
        }
      }

      if (answer) {
        answer.points = points;
        answer.isCorrect = isValidated;
      }

      const updatedPlayer = this.updateScore(player.id, points);
      scores.push({
        playerId: player.id,
        points,
        total: updatedPlayer?.score || player.score,
      });

      if (points > bestPoints) {
        bestPoints = points;
        winner = player;
      }
    }

    const results: RoundResult = {
      roundNumber: this.currentRound,
      question: this.currentQuestion,
      answers: Array.from(this.answers.values()),
      correctAnswer: q.playerName,
      winner,
      scores,
    };

    this.io.to(this.room.code).emit("parcours:validation_result", validation);
    this.updateLoseStreaks(results);
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
    this.io.to(this.room.code).emit("game:round_end", results);

    if (this.currentTeams) {
      this.processTeamRoundEnd(results.scores);
    }

    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
  }

  // ==========================================
  // GUESS GAME VALIDATION METHODS
  // ==========================================

  private startGuessGameValidation(): void {
    this.guessGameValidating = true;
    this.guessGameDecisions.clear();
    const q = this.currentQuestion as GuessGameQuestion;
    const activePlayers = this.getActivePlayers();

    // Ensure all players have an answer entry
    for (const player of activePlayers) {
      if (!this.answers.has(player.id)) {
        this.answers.set(player.id, {
          playerId: player.id,
          questionId: q.id,
          answer: "",
          timestamp: Date.now(),
        });
      }
    }

    this.guessGamePlayerAnswers = activePlayers.map((player) => {
      const answer = this.answers.get(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        answer: answer?.answer || "",
      };
    });

    this.io.to(this.room.code).emit("guessgame:validation_start", {
      gameTitle: q.gameTitle,
      imageUrl: q.imageUrl,
      playerAnswers: this.guessGamePlayerAnswers,
    });

    // Auto-validation timeout: 60 seconds
    this.guessGameAutoValidationTimer = setTimeout(() => {
      if (this.guessGameValidating) {
        for (const pa of this.guessGamePlayerAnswers) {
          if (this.guessGameDecisions.has(pa.playerId)) continue;
          if (!pa.answer) {
            this.guessGameDecisions.set(pa.playerId, false);
            continue;
          }
          const normalized = GameEngine.normalizeForComparison(pa.answer);
          const isMatch = q.acceptedAnswers.some(
            (accepted) => GameEngine.normalizeForComparison(accepted) === normalized
          );
          this.guessGameDecisions.set(pa.playerId, isMatch);
          this.io.to(this.room.code).emit("guessgame:answer_result", {
            playerId: pa.playerId,
            playerName: pa.playerName,
            playerAvatar: pa.playerAvatar,
            answer: pa.answer,
            accepted: isMatch,
          });
        }
        setTimeout(() => {
          this.finalizeGuessGameFromDecisions();
        }, 1500);
      }
    }, 60000);
  }

  validateSingleGuessGameAnswer(playerId: string, accepted: boolean): void {
    if (!this.guessGameValidating || !this.currentQuestion) return;
    if (this.guessGameDecisions.has(playerId)) return;

    this.guessGameDecisions.set(playerId, accepted);

    const pa = this.guessGamePlayerAnswers.find((p) => p.playerId === playerId);
    if (!pa) return;

    this.io.to(this.room.code).emit("guessgame:answer_result", {
      playerId: pa.playerId,
      playerName: pa.playerName,
      playerAvatar: pa.playerAvatar,
      answer: pa.answer,
      accepted,
    });

    const playersToReview = this.guessGamePlayerAnswers.filter(
      (p) => p.answer.trim().length > 0
    );
    const allReviewed = playersToReview.every((p) =>
      this.guessGameDecisions.has(p.playerId)
    );

    if (allReviewed) {
      for (const p of this.guessGamePlayerAnswers) {
        if (!this.guessGameDecisions.has(p.playerId)) {
          this.guessGameDecisions.set(p.playerId, false);
        }
      }
      setTimeout(() => {
        this.finalizeGuessGameFromDecisions();
      }, 2000);
    }
  }

  private finalizeGuessGameFromDecisions(): void {
    if (!this.guessGameValidating) return;

    const validatedPlayerIds = Array.from(this.guessGameDecisions.entries())
      .filter(([, accepted]) => accepted)
      .map(([id]) => id);

    this.submitGuessGameValidation({ validatedPlayerIds });
  }

  submitGuessGameValidation(validation: GuessGameValidationSubmission): void {
    if (!this.currentQuestion || !this.guessGameValidating) return;
    this.guessGameValidating = false;

    if (this.guessGameAutoValidationTimer) {
      clearTimeout(this.guessGameAutoValidationTimer);
      this.guessGameAutoValidationTimer = null;
    }

    const q = this.currentQuestion as GuessGameQuestion;
    const scores: { playerId: string; points: number; total: number }[] = [];
    let bestPoints = 0;
    let winner: Player | undefined;

    for (const player of this.room.players) {
      const answer = this.answers.get(player.id);
      const isValidated = validation.validatedPlayerIds.includes(player.id);

      let points = 0;
      if (isValidated && answer) {
        points = q.points;

        // Speed bonus: faster responses get more points
        if (answer.responseTime !== undefined) {
          const speedBonus = Math.max(0, Math.round((q.timeLimit - answer.responseTime) / q.timeLimit * 50));
          points += speedBonus;
        }
      }

      if (answer) {
        answer.points = points;
        answer.isCorrect = isValidated;
      }

      const updatedPlayer = this.updateScore(player.id, points);
      scores.push({
        playerId: player.id,
        points,
        total: updatedPlayer?.score || player.score,
      });

      if (points > bestPoints) {
        bestPoints = points;
        winner = player;
      }
    }

    const results: RoundResult = {
      roundNumber: this.currentRound,
      question: this.currentQuestion,
      answers: Array.from(this.answers.values()),
      correctAnswer: q.gameTitle,
      winner,
      scores,
    };

    this.io.to(this.room.code).emit("guessgame:validation_result", validation);
    this.updateLoseStreaks(results);
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
    this.io.to(this.room.code).emit("game:round_end", results);

    if (this.currentTeams) {
      this.processTeamRoundEnd(results.scores);
    }

    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
  }

  // ==========================================
  // CONSENSUS VALIDATION METHODS
  // ==========================================

  private startConsensusValidation(): void {
    this.consensusValidating = true;
    this.consensusDecisions.clear();
    const q = this.currentQuestion as ConsensusQuestion;
    const activePlayers = this.getActivePlayers();

    // Ensure all players have an answer entry
    for (const player of activePlayers) {
      if (!this.answers.has(player.id)) {
        this.answers.set(player.id, {
          playerId: player.id,
          questionId: q.id,
          answer: "",
          timestamp: Date.now(),
        });
      }
    }

    this.consensusPlayerAnswers = activePlayers.map((player) => {
      const answer = this.answers.get(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        answer: answer?.answer || "",
      };
    });

    this.io.to(this.room.code).emit("consensus:validation_start", {
      prompt: q.prompt,
      category: q.category,
      playerAnswers: this.consensusPlayerAnswers,
    });

    // Auto-validation timeout: 60 seconds
    this.consensusAutoValidationTimer = setTimeout(() => {
      if (this.consensusValidating) {
        // Auto-accept all non-empty answers
        for (const pa of this.consensusPlayerAnswers) {
          if (this.consensusDecisions.has(pa.playerId)) continue;
          const accepted = pa.answer.trim().length > 0;
          this.consensusDecisions.set(pa.playerId, accepted);
          this.io.to(this.room.code).emit("consensus:answer_result", {
            playerId: pa.playerId,
            playerName: pa.playerName,
            playerAvatar: pa.playerAvatar,
            answer: pa.answer,
            accepted,
          });
        }
        setTimeout(() => {
          this.finalizeConsensusFromDecisions();
        }, 1500);
      }
    }, 60000);
  }

  validateSingleConsensusAnswer(playerId: string, accepted: boolean): void {
    if (!this.consensusValidating || !this.currentQuestion) return;
    if (this.consensusDecisions.has(playerId)) return;

    this.consensusDecisions.set(playerId, accepted);

    const pa = this.consensusPlayerAnswers.find((p) => p.playerId === playerId);
    if (!pa) return;

    this.io.to(this.room.code).emit("consensus:answer_result", {
      playerId: pa.playerId,
      playerName: pa.playerName,
      playerAvatar: pa.playerAvatar,
      answer: pa.answer,
      accepted,
    });

    // Check if all players with answers have been reviewed
    const playersToReview = this.consensusPlayerAnswers.filter(
      (p) => p.answer.trim().length > 0
    );
    const allReviewed = playersToReview.every((p) =>
      this.consensusDecisions.has(p.playerId)
    );

    if (allReviewed) {
      // Mark empty-answer players as rejected
      for (const p of this.consensusPlayerAnswers) {
        if (!this.consensusDecisions.has(p.playerId)) {
          this.consensusDecisions.set(p.playerId, false);
        }
      }
      setTimeout(() => {
        this.finalizeConsensusFromDecisions();
      }, 2000);
    }
  }

  private finalizeConsensusFromDecisions(): void {
    if (!this.consensusValidating) return;

    const validatedPlayerIds = Array.from(this.consensusDecisions.entries())
      .filter(([, accepted]) => accepted)
      .map(([id]) => id);

    this.submitConsensusValidation({ validatedPlayerIds });
  }

  private submitConsensusValidation(validation: ConsensusValidationSubmission): void {
    if (!this.currentQuestion || !this.consensusValidating) return;
    this.consensusValidating = false;

    if (this.consensusAutoValidationTimer) {
      clearTimeout(this.consensusAutoValidationTimer);
      this.consensusAutoValidationTimer = null;
    }

    const q = this.currentQuestion as ConsensusQuestion;
    const scores: { playerId: string; points: number; total: number }[] = [];
    let winner: Player | undefined;

    // Group only validated answers
    const groups = new Map<string, { playerIds: string[]; rawAnswer: string }>();
    for (const [playerId, answer] of this.answers) {
      if (!validation.validatedPlayerIds.includes(playerId)) continue;
      const normalized = GameEngine.normalizeForComparison(answer.answer);
      if (!normalized) continue;

      if (!groups.has(normalized)) {
        groups.set(normalized, { playerIds: [], rawAnswer: answer.answer.trim() });
      }
      groups.get(normalized)!.playerIds.push(playerId);
    }

    // Find largest group(s)
    let maxGroupSize = 0;
    for (const [, group] of groups) {
      if (group.playerIds.length > maxGroupSize) {
        maxGroupSize = group.playerIds.length;
      }
    }

    const winningPlayerIds = new Set<string>();
    let winningAnswer = "";
    let earliestWinnerTime = Infinity;

    for (const [, group] of groups) {
      if (group.playerIds.length === maxGroupSize && maxGroupSize > 0) {
        for (const pid of group.playerIds) {
          winningPlayerIds.add(pid);
        }
        if (!winningAnswer) winningAnswer = group.rawAnswer;
      }
    }

    // Score players
    for (const [playerId, answer] of this.answers) {
      const isWinner = winningPlayerIds.has(playerId);
      const points = isWinner ? q.points : 0;
      answer.isCorrect = isWinner;
      answer.points = points;

      if (isWinner && (answer.responseTime || Infinity) < earliestWinnerTime) {
        earliestWinnerTime = answer.responseTime || Infinity;
        winner = this.room.players.find((p) => p.id === playerId);
      }

      const updatedPlayer = this.updateScore(playerId, points);
      if (updatedPlayer) {
        scores.push({ playerId, points, total: updatedPlayer.score });
      }
    }

    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
        scores.push({ playerId: player.id, points: 0, total: player.score });
      }
    }

    const results: RoundResult = {
      roundNumber: this.currentRound,
      question: this.currentQuestion,
      answers: Array.from(this.answers.values()),
      correctAnswer: winningAnswer || q.prompt,
      winner,
      scores,
    };

    this.updateLoseStreaks(results);
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
    this.io.to(this.room.code).emit("game:round_end", results);

    if (this.currentTeams) {
      this.processTeamRoundEnd(results.scores);
    }

    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);
      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
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
   * Start the suggestion phase: players suggest phrases (30s)
   */
  private startSuggestionPhase(): void {
    this.drawingPhase = "suggesting";
    this.suggestions.clear();
    this.suggestionAssignments.clear();
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

    const timeLimit = 30;
    this.timeRemaining = timeLimit;

    this.io.to(this.room.code).emit("drawing:phase_start", "suggesting", {
      phase: "suggesting",
      timeLimit,
      totalPlayers: activePlayers.length,
    });

    this.startTimer();
  }

  /**
   * Submit a suggestion for drawing
   */
  submitSuggestion(playerId: string, suggestion: string): void {
    if (this.drawingPhase !== "suggesting") return;
    if (this.suggestions.has(playerId)) return;

    this.suggestions.set(playerId, suggestion.trim());
    this.io.to(this.room.code).emit("game:player_answered", playerId);

    // Check if all active players submitted
    const activePlayers = this.getActivePlayers();
    if (this.suggestions.size >= activePlayers.length) {
      this.stopTimer();
      this.startDrawingPhase();
    }
  }

  /**
   * Start the drawing phase: assign suggested phrases and begin timer
   * Rotation: Player[i] suggests → Player[(i+1)] draws → Player[(i+2)] guesses
   */
  private startDrawingPhase(): void {
    this.drawingPhase = "drawing";

    const activePlayers = this.getActivePlayers();
    const n = activePlayers.length;

    // For players who didn't submit a suggestion, use fallback from pool
    const fallbackPool = this.drawingQuestionPool.length > 0
      ? [...this.drawingQuestionPool].sort(() => Math.random() - 0.5)
      : [{ id: "fallback", type: "drawing" as const, phrase: "Un chat qui joue du piano", timeLimit: 90, points: 100 }];
    let fallbackIdx = 0;
    for (const player of activePlayers) {
      if (!this.suggestions.has(player.id)) {
        const fb = fallbackPool[fallbackIdx % fallbackPool.length];
        this.suggestions.set(player.id, fb.phrase);
        fallbackIdx++;
      }
    }

    // Build 3-role circular rotation:
    // Chain i: Player[i] suggests → Player[(i+1) % n] draws → Player[(i+2) % n] guesses
    for (let i = 0; i < n; i++) {
      const suggester = activePlayers[i];
      const drawer = activePlayers[(i + 1) % n];
      const guesser = activePlayers[(i + 2) % n];

      const phrase = this.suggestions.get(suggester.id)!;
      this.playerPhrases.set(drawer.id, { phrase, questionId: `suggestion_${suggester.id}` });
      this.suggestionAssignments.set(drawer.id, suggester.id);
      this.drawingAssignments.set(guesser.id, drawer.id);
    }

    const timeLimit = 120;
    this.timeRemaining = timeLimit;

    // Emit phase start to room
    this.io.to(this.room.code).emit("drawing:phase_start", "drawing", {
      phase: "drawing",
      timeLimit,
      totalPlayers: activePlayers.length,
    });

    // Send each drawer their assigned phrase
    for (const player of activePlayers) {
      const phraseData = this.playerPhrases.get(player.id);
      if (phraseData) {
        const socketId = this.roomManager.getSocketIdFromPlayerId(player.id);
        if (socketId) {
          this.io.to(socketId).emit("drawing:your_phrase", phraseData.phrase, phraseData.questionId);
        }
      }
    }

    this.startTimer();
  }

  /**
   * Handle drawing timer expiration
   */
  private onDrawingTimerExpired(): void {
    this.stopTimer();

    if (this.drawingPhase === "suggesting") {
      this.startDrawingPhase();
    } else if (this.drawingPhase === "drawing") {
      // Grace period: let clients auto-submit their drawings before transitioning.
      // Clients auto-submit at timeRemaining<=1, so 1.5s is enough for the round-trip.
      setTimeout(() => {
        if (this.drawingPhase === "drawing") {
          // Auto-submit empty drawings for players who didn't submit
          const activePlayers = this.getActivePlayers();
          for (const player of activePlayers) {
            if (!this.drawings.has(player.id)) {
              this.drawings.set(player.id, "NO_DRAWING");
              this.io.to(this.room.code).emit("game:player_answered", player.id);
            }
          }
          this.startGuessingPhase();
        }
      }, 1500);
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
        if (socketId) {
          // Always emit, even if drawingData is empty (artist didn't submit)
          this.io.to(socketId).emit("drawing:your_guess_target", drawingData || "NO_DRAWING");
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

    // Build chains with 3 roles: suggester → drawer → guesser
    this.drawingChains = [];
    for (const artist of activePlayers) {
      const phraseData = this.playerPhrases.get(artist.id);
      const drawingData = this.drawings.get(artist.id);
      if (!phraseData) continue;

      // Find the suggester for this artist's phrase
      const suggesterId = this.suggestionAssignments.get(artist.id) || artist.id;
      const suggester = this.room.players.find((p) => p.id === suggesterId);

      // Find the guesser for this artist
      let guesserId = "";
      for (const [gId, aId] of this.drawingAssignments) {
        if (aId === artist.id) { guesserId = gId; break; }
      }

      const guesser = this.room.players.find((p) => p.id === guesserId);
      const guess = this.guesses.get(guesserId) || "";

      this.drawingChains.push({
        suggesterId,
        suggesterName: suggester?.name || "???",
        suggesterAvatar: suggester?.avatar || "🦊",
        artistId: artist.id,
        artistName: artist.name,
        artistAvatar: artist.avatar,
        phrase: phraseData.phrase,
        drawingData: drawingData || "",
        guesserId,
        guesserName: guesser?.name || "???",
        guesserAvatar: guesser?.avatar || "🦊",
        guess,
        isGuessCorrect: null, // Pending host validation
      });
    }

    // Initialize reveal navigation (scores calculated after host validates all chains)
    this.revealState = {
      chains: this.drawingChains,
      currentChainIndex: 0,
      currentStep: 0,
    };

    this.io.to(this.room.code).emit("drawing:reveal_state", this.revealState);
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

      const updatedPlayer = this.updateScore(player.id, points);

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
    const currentChain = this.revealState.chains[this.revealState.currentChainIndex];

    // Block advancing past step 2 if chain not yet validated by host
    if (this.revealState.currentStep === 2 && currentChain.isGuessCorrect === null) {
      return;
    }

    if (this.revealState.currentStep < totalSteps - 1) {
      this.revealState.currentStep++;
    } else if (this.revealState.currentChainIndex < totalChains - 1) {
      this.revealState.currentChainIndex++;
      this.revealState.currentStep = 0;
    } else {
      // All chains revealed — calculate scores, update lose streaks, then proceed
      const scores = this.calculateDrawingScores();
      this.lastDrawingScores = scores;

      this.io.to(this.room.code).emit("drawing:round_scores", {
        roundNumber: this.currentRound,
        chains: this.drawingChains,
        scores,
      });

      this.updateDrawingLoseStreaks(scores);
      this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      setTimeout(() => {
        this.nextRound();
      }, 2000);
      return;
    }

    this.io.to(this.room.code).emit("drawing:reveal_step",
      this.revealState.currentChainIndex,
      this.revealState.currentStep
    );
  }

  /**
   * Host validates a drawing chain guess as correct or incorrect
   */
  validateDrawingChain(chainIndex: number, accepted: boolean): void {
    if (!this.revealState) return;
    if (chainIndex < 0 || chainIndex >= this.drawingChains.length) return;

    this.drawingChains[chainIndex].isGuessCorrect = accepted;
    this.revealState.chains[chainIndex].isGuessCorrect = accepted;

    this.io.to(this.room.code).emit("drawing:chain_validated", chainIndex, accepted);

    // Auto-advance to step 3 (verdict) after validation
    if (this.revealState.currentChainIndex === chainIndex && this.revealState.currentStep === 2) {
      this.revealState.currentStep = 3;
      this.io.to(this.room.code).emit("drawing:reveal_step",
        this.revealState.currentChainIndex,
        this.revealState.currentStep
      );
    }
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

  // ==========================================
  // SPLIT OR STEAL METHODS
  // ==========================================

  private startSplitStealPhase(): void {
    this.splitStealChoices.clear();

    const activePlayers = this.getActivePlayers();

    if (activePlayers.length < 2) {
      this.nextRound();
      return;
    }

    // 2-player variant: Valise Mystère
    if (activePlayers.length === 2) {
      this.startValisePhase(activePlayers);
      return;
    }

    const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
    const isOdd = shuffled.length % 2 !== 0;

    // Map to store personalized data for each player
    const playerDataMap = new Map<string, SplitStealStartData>();

    if (isOdd) {
      // Cycle mode: A→B→C→...→A
      this.splitStealPairingType = "cycle";
      this.splitStealCycle = shuffled.map((p) => p.id);
      this.splitStealPairs = [];

      // Create data for each player in cycle
      for (let i = 0; i < shuffled.length; i++) {
        const player = shuffled[i];
        const target = shuffled[(i + 1) % shuffled.length];
        const incoming = shuffled[(i - 1 + shuffled.length) % shuffled.length];

        const data: SplitStealStartData = {
          pairingType: "cycle",
          targetId: target.id,
          targetName: target.name,
          targetAvatar: target.avatar,
          incomingId: incoming.id,
          incomingName: incoming.name,
          incomingAvatar: incoming.avatar,
          timeLimit: 20,
        };

        playerDataMap.set(player.id, data);
      }
    } else {
      // Pair mode: (A,B), (C,D), ...
      this.splitStealPairingType = "pair";
      this.splitStealPairs = [];
      this.splitStealCycle = [];

      for (let i = 0; i < shuffled.length; i += 2) {
        this.splitStealPairs.push([shuffled[i].id, shuffled[i + 1].id]);
      }

      // Create data for each player in pairs
      for (const [aId, bId] of this.splitStealPairs) {
        const playerA = shuffled.find((p) => p.id === aId)!;
        const playerB = shuffled.find((p) => p.id === bId)!;

        const dataA: SplitStealStartData = {
          pairingType: "pair",
          targetId: playerB.id,
          targetName: playerB.name,
          targetAvatar: playerB.avatar,
          timeLimit: 20,
        };
        const dataB: SplitStealStartData = {
          pairingType: "pair",
          targetId: playerA.id,
          targetName: playerA.name,
          targetAvatar: playerA.avatar,
          timeLimit: 20,
        };

        playerDataMap.set(aId, dataA);
        playerDataMap.set(bId, dataB);
      }
    }

    // Send each player their personalized data
    // Use direct socket targeting, but guarantee delivery via room broadcast as fallback
    for (const [playerId, data] of playerDataMap) {
      const socketId = this.roomManager.getSocketIdFromPlayerId(playerId);
      if (socketId) {
        // Send directly to player's socket
        this.io.to(socketId).emit("splitsteal:phase_start", data);
      } else {
        // Fallback: broadcast to room (less efficient but guarantees host and AFK players get data)
        console.warn(`Socket ID not found for player ${playerId}, broadcasting to room`);
        this.io.to(this.room.code).emit("splitsteal:phase_start", data);
      }
    }

    // Start 20s timer
    this.timeRemaining = 20;
    this.startTimer();
  }

  submitSplitStealChoice(playerId: string, choice: "split" | "steal"): void {
    if (this.splitStealChoices.has(playerId)) return;

    this.splitStealChoices.set(playerId, choice);
    this.io.to(this.room.code).emit("splitsteal:player_chose", playerId);

    // Check if all active players have chosen
    const activePlayers = this.getActivePlayers();
    if (this.splitStealChoices.size >= activePlayers.length) {
      this.resolveSplitSteal();
    }
  }

  // ==========================================
  // VALISE MYSTÈRE METHODS (2-player variant)
  // ==========================================

  private startValisePhase(activePlayers: { id: string; name: string; avatar: string; score: number }[]): void {
    this.valiseMode = true;
    this.valisePorteurSignal = null;
    this.valiseVoleurChoice = null;

    // Alternate roles each round
    const porteurIndex = this.valiseRoundIndex % 2;
    this.valiseRoundIndex++;

    const porteur = activePlayers[porteurIndex];
    const voleur = activePlayers[1 - porteurIndex];
    this.valisePorteurId = porteur.id;
    this.valiseVoleurId = voleur.id;

    // Random value from [-200, -150, -100, -50, +50, +100, +150, +200]
    const possibleValues = [-200, -150, -100, -50, 50, 100, 150, 200];
    this.valiseValue = possibleValues[Math.floor(Math.random() * possibleValues.length)];

    // Send porteur their data (with valise value visible)
    const porteurSocketId = this.roomManager.getSocketIdFromPlayerId(porteur.id);
    if (porteurSocketId) {
      this.io.to(porteurSocketId).emit("valise:phase_start", {
        role: "porteur",
        valiseValue: this.valiseValue,
        opponentId: voleur.id,
        opponentName: voleur.name,
        opponentAvatar: voleur.avatar,
        timeLimit: 30,
      });
    }

    // Send voleur their data (valise value hidden)
    const voleurSocketId = this.roomManager.getSocketIdFromPlayerId(voleur.id);
    if (voleurSocketId) {
      this.io.to(voleurSocketId).emit("valise:phase_start", {
        role: "voleur",
        valiseValue: null,
        opponentId: porteur.id,
        opponentName: porteur.name,
        opponentAvatar: porteur.avatar,
        timeLimit: 30,
      });
    }

    // Start 30s timer
    this.timeRemaining = 30;
    this.startTimer();
  }

  submitValiseSignal(playerId: string, signal: "prends" | "laisse"): void {
    if (playerId !== this.valisePorteurId) return;
    if (this.valisePorteurSignal !== null) return;

    this.valisePorteurSignal = signal;

    // Broadcast signal to the voleur
    const voleurSocketId = this.roomManager.getSocketIdFromPlayerId(this.valiseVoleurId);
    if (voleurSocketId) {
      this.io.to(voleurSocketId).emit("valise:porteur_signal", signal);
    }
  }

  submitValiseChoice(playerId: string, choice: "voler" | "laisser"): void {
    if (playerId !== this.valiseVoleurId) return;
    if (this.valiseVoleurChoice !== null) return;

    this.valiseVoleurChoice = choice;
    this.resolveValise();
  }

  private resolveValise(): void {
    this.stopTimer();
    this.valiseMode = false;

    // If voleur didn't choose (timeout), random 50/50
    if (this.valiseVoleurChoice === null) {
      this.valiseVoleurChoice = Math.random() < 0.5 ? "voler" : "laisser";
    }

    const activePlayers = this.getActivePlayers();
    const porteur = activePlayers.find((p) => p.id === this.valisePorteurId);
    const voleur = activePlayers.find((p) => p.id === this.valiseVoleurId);
    if (!porteur || !voleur) {
      this.nextRound();
      return;
    }

    // Resolve scoring
    let porteurPoints = 0;
    let voleurPoints = 0;

    if (this.valiseVoleurChoice === "laisser") {
      // Voleur leaves → porteur gets the valise points
      porteurPoints = this.valiseValue;
      voleurPoints = 0;
    } else {
      // Voleur steals → voleur gets the valise points (positive or negative!)
      porteurPoints = 0;
      voleurPoints = this.valiseValue;
    }

    // Apply scores
    this.updateScore(porteur.id, porteurPoints);
    this.updateScore(voleur.id, voleurPoints);

    const scores: { playerId: string; points: number; total: number }[] = [];
    for (const player of this.room.players) {
      const pts = player.id === porteur.id ? porteurPoints : player.id === voleur.id ? voleurPoints : 0;
      const updatedPlayer = this.room.players.find((p) => p.id === player.id);
      scores.push({
        playerId: player.id,
        points: pts,
        total: updatedPlayer?.score || 0,
      });
    }

    // Build reveal data
    const revealData = {
      valiseValue: this.valiseValue,
      porteurId: porteur.id,
      porteurName: porteur.name,
      porteurAvatar: porteur.avatar,
      porteurSignal: this.valisePorteurSignal,
      voleurId: voleur.id,
      voleurName: voleur.name,
      voleurAvatar: voleur.avatar,
      voleurChoice: this.valiseVoleurChoice,
      playerScores: scores.map((s) => ({ playerId: s.playerId, points: s.points })),
    };

    // Build round result
    const roundResult = {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: [],
      correctAnswer: "",
      scores,
    };

    // Emit reveal
    this.io.to(this.room.code).emit("valise:reveal", revealData);

    // Update lose streaks
    this.updateLoseStreaks(roundResult);

    // After reveal delay, proceed
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
    this.io.to(this.room.code).emit("game:round_end", roundResult);

    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);
      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
  }

  private resolveSplitSteal(): void {
    this.stopTimer();

    const activePlayers = this.getActivePlayers();

    // Auto-Steal for players who didn't choose (timeout/AFK)
    for (const player of activePlayers) {
      if (!this.splitStealChoices.has(player.id)) {
        this.splitStealChoices.set(player.id, "steal");
      }
    }

    // Build choices array for reveal
    const choices: SplitStealChoiceEntry[] = [];
    const playerScores: Map<string, number> = new Map();
    const centerOfSteals: Set<string> = new Set();

    // Initialize scores to 0
    for (const player of activePlayers) {
      playerScores.set(player.id, 0);
    }

    if (this.splitStealPairingType === "pair") {
      // Pair mode: mutual choices
      for (const [aId, bId] of this.splitStealPairs) {
        const aChoice = this.splitStealChoices.get(aId) || "steal";
        const bChoice = this.splitStealChoices.get(bId) || "steal";
        const playerA = activePlayers.find((p) => p.id === aId);
        const playerB = activePlayers.find((p) => p.id === bId);
        if (!playerA || !playerB) continue;

        choices.push({
          playerId: aId,
          playerName: playerA.name,
          playerAvatar: playerA.avatar,
          choice: aChoice,
          targetPlayerId: bId,
        });
        choices.push({
          playerId: bId,
          playerName: playerB.name,
          playerAvatar: playerB.avatar,
          choice: bChoice,
          targetPlayerId: aId,
        });

        if (aChoice === "split" && bChoice === "split") {
          playerScores.set(aId, (playerScores.get(aId) || 0) + 100);
          playerScores.set(bId, (playerScores.get(bId) || 0) + 100);
        } else if (aChoice === "split" && bChoice === "steal") {
          playerScores.set(bId, (playerScores.get(bId) || 0) + 250);
        } else if (aChoice === "steal" && bChoice === "split") {
          playerScores.set(aId, (playerScores.get(aId) || 0) + 250);
        } else {
          // Both steal: malus -200
          playerScores.set(aId, (playerScores.get(aId) || 0) - 200);
          playerScores.set(bId, (playerScores.get(bId) || 0) - 200);
        }
      }
    } else {
      // Cycle mode: directed choices A→B→C→...→A
      const cycle = this.splitStealCycle;

      for (let i = 0; i < cycle.length; i++) {
        const playerId = cycle[i];
        const targetId = cycle[(i + 1) % cycle.length];
        const choice = this.splitStealChoices.get(playerId) || "steal";
        const player = activePlayers.find((p) => p.id === playerId);
        const target = activePlayers.find((p) => p.id === targetId);
        if (!player || !target) continue;

        choices.push({
          playerId,
          playerName: player.name,
          playerAvatar: player.avatar,
          choice,
          targetPlayerId: targetId,
        });

        if (choice === "split") {
          playerScores.set(playerId, (playerScores.get(playerId) || 0) + 100);
          playerScores.set(targetId, (playerScores.get(targetId) || 0) + 100);
        } else {
          // Steal: decider gets 250, target gets 0
          playerScores.set(playerId, (playerScores.get(playerId) || 0) + 250);
        }
      }

      // Check for "center of 2 steals" malus
      for (let i = 0; i < cycle.length; i++) {
        const playerId = cycle[i];
        const prevId = cycle[(i - 1 + cycle.length) % cycle.length];
        const didSteal = this.splitStealChoices.get(playerId) === "steal";
        const wasStolen = this.splitStealChoices.get(prevId) === "steal";

        if (didSteal && wasStolen) {
          centerOfSteals.add(playerId);
          playerScores.set(playerId, (playerScores.get(playerId) || 0) - 200);
        }
      }
    }

    // Apply scores to room
    const scores: { playerId: string; points: number; total: number }[] = [];
    for (const player of this.room.players) {
      const pts = playerScores.get(player.id) || 0;
      this.updateScore(player.id, pts);
      const updatedPlayer = this.room.players.find((p) => p.id === player.id);
      scores.push({
        playerId: player.id,
        points: pts,
        total: updatedPlayer?.score || 0,
      });
    }

    // Build reveal data
    const revealData: SplitStealRevealData = {
      pairingType: this.splitStealPairingType,
      choices,
      playerScores: scores.map((s) => ({
        playerId: s.playerId,
        points: s.points,
        isCenterOfSteals: centerOfSteals.has(s.playerId),
      })),
    };

    // Build round result for standard flow
    const roundResult: RoundResult = {
      roundNumber: this.currentRound,
      question: this.currentQuestion!,
      answers: [],
      correctAnswer: "",
      scores,
    };

    // Emit reveal
    this.io.to(this.room.code).emit("splitsteal:reveal", revealData);

    // Update lose streaks
    this.updateLoseStreaks(roundResult);

    // After reveal delay, proceed
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
    this.io.to(this.room.code).emit("game:round_end", roundResult);

    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);
      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
  }

  /**
   * Proceed to the next round
   */
  nextRound(): void {
    if (this.comebackMode) {
      const total = this.room.settings.comebackTotalRounds || 15;
      if (this.currentRound >= total) {
        this.finishGame();
      } else {
        this.startRound();
      }
    } else if (this.currentRound >= this.questions.length) {
      this.finishGame();
    } else {
      this.startRound();
    }
  }

  // ==========================================
  // COMEBACK MODE HELPERS ("Aide aux derniers")
  // ==========================================

  /** Wrapper for updatePlayerScore that applies comeback x2 bonus */
  private updateScore(playerId: string, points: number): Player | null {
    const finalPoints = (this.comebackMode && this.comebackBonusPlayerId === playerId && points > 0)
      ? points * 2
      : points;
    return this.roomManager.updatePlayerScore(playerId, finalPoints);
  }

  private getComebackLastPlayer(): Player {
    const connected = this.room.players.filter((p) => p.isConnected);
    if (connected.length === 0) return this.room.players[0];
    // Sort ascending by score, pick the lowest
    const sorted = [...connected].sort((a, b) => a.score - b.score);
    const minScore = sorted[0].score;
    const lastPlayers = sorted.filter((p) => p.score === minScore);
    // Random among tied players
    return lastPlayers[Math.floor(Math.random() * lastPlayers.length)];
  }

  private getComebackAvailableModes(): string[] {
    // All game modes that have content available
    return [
      "qcm", "open", "estimation", "dictation", "parcours",
      "image", "petitbac", "geoquiz", "langue", "maths",
      "guessgame", "lineup", "jerseynumber", "futcard",
      "chrono", "consensus", "liste",
    ];
  }

  private startComebackPick(lastPlayer: Player): void {
    const availableModes = this.getComebackAvailableModes();

    // Emit pick event to all players
    this.io.to(this.room.code).emit("comeback:pick_mode", {
      playerId: lastPlayer.id,
      playerName: lastPlayer.name,
      playerAvatar: lastPlayer.avatar,
      availableModes: availableModes as any,
      timeLimit: 10,
    });

    // 10-second timeout — fallback to random
    this.comebackPickTimer = setTimeout(() => {
      this.comebackPickTimer = null;
      const randomMode = availableModes[Math.floor(Math.random() * availableModes.length)];
      this.comebackExecutePick(randomMode, lastPlayer);
    }, 10000);
  }

  /** Called when the last player picks a mode (or timeout fallback) */
  handleComebackChooseMode(playerId: string, mode: string): void {
    // Only the designated last player can pick
    if (!this.comebackMode || this.comebackBonusPlayerId !== playerId) return;
    if (!this.comebackPickTimer) return; // already picked or timed out

    clearTimeout(this.comebackPickTimer);
    this.comebackPickTimer = null;

    const available = this.getComebackAvailableModes();
    const finalMode = available.includes(mode) ? mode : available[Math.floor(Math.random() * available.length)];

    const player = this.room.players.find((p) => p.id === playerId);
    if (player) {
      this.comebackExecutePick(finalMode, player);
    }
  }

  private comebackExecutePick(mode: string, picker: Player): void {
    // Notify all players which mode was picked
    this.io.to(this.room.code).emit("comeback:mode_picked", {
      playerId: picker.id,
      playerName: picker.name,
      mode: mode as any,
      bonusPlayerId: this.comebackBonusPlayerId!,
    });

    // Short delay to show the pick, then load question and start
    setTimeout(() => {
      this.comebackLoadAndStart(mode);
    }, 2500);
  }

  private comebackLoadRandomAndStart(): void {
    const modes = this.getComebackAvailableModes();
    const mode = modes[Math.floor(Math.random() * modes.length)];
    this.comebackLoadAndStart(mode);
  }

  private comebackLoadAndStart(mode: string): void {
    // Load 1 question for this mode
    const questions = this.loadQuestionsForMode(mode, 1);
    if (questions.length === 0) {
      // Fallback
      this.questions.push(SAMPLE_QUESTIONS[Math.floor(Math.random() * SAMPLE_QUESTIONS.length)]);
    } else {
      this.questions.push(questions[0]);
    }

    // Now proceed with the standard round start logic
    this.comebackStartLoadedRound();
  }

  /** Start a round that was already loaded into this.questions (comeback mode) */
  private comebackStartLoadedRound(): void {
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

    // Team burst logic (skip for drawing, lineup, and lettres modes)
    if (this.teamRoundsEnabled && nextMode !== "drawing" && nextMode !== "lineup" && nextMode !== "lettres") {
      if (this.teamBurstRemaining > 0) {
        this.teamBurstRemaining--;
        this.io.to(this.room.code).emit("game:team_round_start", {
          teams: this.currentTeams!,
          burstRoundsRemaining: this.teamBurstRemaining,
        });
      } else if (this.currentTeams === null && Math.random() < 0.3) {
        const burstLength = 1 + Math.floor(Math.random() * 3);
        this.teamBurstRemaining = burstLength - 1;
        this.currentTeams = this.splitPlayersIntoTeams();
        this.io.to(this.room.code).emit("game:team_round_start", {
          teams: this.currentTeams,
          burstRoundsRemaining: this.teamBurstRemaining,
        });
      }
    }

    // Split or Steal mode
    if (nextMode === "splitsteal") {
      this.currentQuestion = nextQuestion;
      this.startSplitStealPhase();
      return;
    }

    // Drawing mode
    if (nextMode === "drawing") {
      this.currentQuestion = nextQuestion;
      this.startSuggestionPhase();
      return;
    }

    // Lineup mode
    if (nextMode === "lineup") {
      this.lineupFoundPlayers.clear();
      this.lineupGlobalFound.clear();
    }

    // Liste mode
    if (nextMode === "liste") {
      this.listeFoundItems.clear();
      this.listeGlobalFound.clear();
      this.listeFinishedPlayers.clear();
    }

    // Petit Bac
    this.petitBacStopTriggered = false;
    if (this.petitBacStopTimer) {
      clearTimeout(this.petitBacStopTimer);
      this.petitBacStopTimer = null;
    }

    this.currentQuestion = nextQuestion;
    this.timeRemaining = this.currentQuestion.timeLimit;

    const questionForClient = this.sanitizeQuestionForClient(this.currentQuestion);
    this.io.to(this.room.code).emit("game:round_start", this.currentRound, questionForClient);

    this.startTimer();
  }

  // ==========================================
  // TEAM ROUNDS HELPERS
  // ==========================================

  private splitPlayersIntoTeams(): TeamInfo[] {
    const playerIds = this.room.players
      .filter((p) => p.isConnected)
      .map((p) => p.id);
    // Shuffle
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
    }
    const mid = Math.ceil(playerIds.length / 2);
    return [
      { id: "blue", name: "Les Bleus", playerIds: playerIds.slice(0, mid) },
      { id: "red", name: "Les Rouges", playerIds: playerIds.slice(mid) },
    ];
  }

  private processTeamRoundEnd(roundScores: { playerId: string; points: number }[]): void {
    if (!this.currentTeams) return;

    const teamTotals: Record<string, number> = { blue: 0, red: 0 };
    for (const team of this.currentTeams) {
      for (const pid of team.playerIds) {
        const entry = roundScores.find((s) => s.playerId === pid);
        teamTotals[team.id] += entry?.points || 0;
      }
    }

    const winningTeamId: "blue" | "red" | "tie" =
      teamTotals.blue > teamTotals.red ? "blue" :
      teamTotals.red > teamTotals.blue ? "red" : "tie";

    // Award team bonus (+50) to winning team members
    const TEAM_BONUS = 50;
    if (winningTeamId !== "tie") {
      const winningTeam = this.currentTeams.find((t) => t.id === winningTeamId)!;
      for (const pid of winningTeam.playerIds) {
        this.updateScore(pid, TEAM_BONUS);
      }
    }

    const teamResult: TeamRoundResult = {
      teams: this.currentTeams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        totalPoints: teamTotals[t.id],
        playerIds: t.playerIds,
      })),
      winningTeamId,
    };

    this.io.to(this.room.code).emit("game:team_round_end", teamResult);

    // If burst is over, clear teams
    if (this.teamBurstRemaining <= 0) {
      this.currentTeams = null;
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

  // ==========================================
  // LETTRES MODE
  // ==========================================

  /**
   * Draw a weighted random letter from a pool
   */
  private static drawWeightedLetter(pool: [string, number][]): string {
    const totalWeight = pool.reduce((sum, [, w]) => sum + w, 0);
    let rand = Math.random() * totalWeight;
    for (const [letter, weight] of pool) {
      rand -= weight;
      if (rand <= 0) return letter;
    }
    return pool[pool.length - 1][0];
  }

  /**
   * Determine if the current pick is forced (to guarantee min vowels/consonants)
   */
  private getLettresForceChoice(): "voyelle" | "consonne" | null {
    const remaining = GameEngine.LETTRES_TOTAL_PICKS - this.lettresLetters.length;
    const vowelsNeeded = Math.max(0, GameEngine.LETTRES_MIN_VOWELS - this.lettresVowelCount);
    const consonantsNeeded = Math.max(0, GameEngine.LETTRES_MIN_CONSONANTS - this.lettresConsonantCount);

    // If all remaining picks must be vowels to meet minimum
    if (remaining <= vowelsNeeded) return "voyelle";
    // If all remaining picks must be consonants to meet minimum
    if (remaining <= consonantsNeeded) return "consonne";

    return null;
  }

  /**
   * Start the letter drawing phase
   */
  private startLettresDrawPhase(): void {
    // Reset state
    this.lettresLetters = [];
    this.lettresVowelCount = 0;
    this.lettresConsonantCount = 0;
    this.lettresValidating = false;
    this.lettresDecisions.clear();
    this.lettresPlayerAnswers = [];
    this.answers.clear();

    // Build pick order: rotate through active players
    const activePlayers = this.getActivePlayers();
    this.lettresPickOrder = [];
    for (let i = 0; i < GameEngine.LETTRES_TOTAL_PICKS; i++) {
      this.lettresPickOrder.push(activePlayers[i % activePlayers.length].id);
    }
    this.lettresCurrentPickIndex = 0;

    const firstPicker = activePlayers.find(p => p.id === this.lettresPickOrder[0]);
    const forced = this.getLettresForceChoice();

    // Emit round start with lettres question (for UI to know the mode)
    const questionForClient = this.sanitizeQuestionForClient(this.currentQuestion!);
    this.io.to(this.room.code).emit("game:round_start", this.currentRound, questionForClient);

    // Start draw phase
    this.io.to(this.room.code).emit("lettres:draw_start", {
      letters: [],
      currentPickerId: this.lettresPickOrder[0],
      currentPickerName: firstPicker?.name || "?",
      pickIndex: 0,
      totalPicks: GameEngine.LETTRES_TOTAL_PICKS,
      forcedChoice: forced,
      timePerPick: GameEngine.LETTRES_TIME_PER_PICK,
    });

    // Start pick timer
    this.startLettresPickTimer();
  }

  /**
   * Start a timer for the current pick (auto-pick on timeout)
   */
  private startLettresPickTimer(): void {
    if (this.lettresPickTimer) {
      clearTimeout(this.lettresPickTimer);
    }
    this.lettresPickTimer = setTimeout(() => {
      // Auto-pick: random choice respecting forced constraint
      const forced = this.getLettresForceChoice();
      const choice = forced || (Math.random() < 0.5 ? "voyelle" : "consonne");
      this.processLettresChoice(this.lettresPickOrder[this.lettresCurrentPickIndex], choice);
    }, GameEngine.LETTRES_TIME_PER_PICK * 1000);
  }

  /**
   * Handle a player's voyelle/consonne choice
   */
  handleLettresChoose(playerId: string, choice: "voyelle" | "consonne"): void {
    // Only current picker can choose
    if (this.lettresCurrentPickIndex >= this.lettresPickOrder.length) return;
    if (playerId !== this.lettresPickOrder[this.lettresCurrentPickIndex]) return;

    // Enforce forced choice
    const forced = this.getLettresForceChoice();
    const finalChoice = forced || choice;

    this.processLettresChoice(playerId, finalChoice);
  }

  /**
   * Process a letter choice (draw a letter and advance)
   */
  private processLettresChoice(_pickerId: string, choice: "voyelle" | "consonne"): void {
    if (this.lettresPickTimer) {
      clearTimeout(this.lettresPickTimer);
      this.lettresPickTimer = null;
    }

    // Draw a letter
    const pool = choice === "voyelle"
      ? GameEngine.LETTRES_VOWELS
      : GameEngine.LETTRES_CONSONANTS;
    const letter = GameEngine.drawWeightedLetter(pool);

    this.lettresLetters.push(letter);
    if (choice === "voyelle") {
      this.lettresVowelCount++;
    } else {
      this.lettresConsonantCount++;
    }

    this.lettresCurrentPickIndex++;

    // Check if all letters drawn
    if (this.lettresCurrentPickIndex >= GameEngine.LETTRES_TOTAL_PICKS) {
      // Emit final letter and transition to find phase
      this.io.to(this.room.code).emit("lettres:letter_drawn", {
        letter,
        letters: [...this.lettresLetters],
        choiceType: choice,
        nextPickerId: null,
        nextPickerName: null,
        pickIndex: this.lettresCurrentPickIndex,
        forcedChoice: null,
      });

      // Short delay then start find phase
      setTimeout(() => {
        this.startLettresFindPhase();
      }, 1500);
      return;
    }

    // Next picker
    const nextPickerId = this.lettresPickOrder[this.lettresCurrentPickIndex];
    const nextPicker = this.room.players.find(p => p.id === nextPickerId);
    const forced = this.getLettresForceChoice();

    this.io.to(this.room.code).emit("lettres:letter_drawn", {
      letter,
      letters: [...this.lettresLetters],
      choiceType: choice,
      nextPickerId,
      nextPickerName: nextPicker?.name || "?",
      pickIndex: this.lettresCurrentPickIndex,
      forcedChoice: forced,
    });

    // Start timer for next pick
    this.startLettresPickTimer();
  }

  /**
   * Start the word-finding phase (25s timer)
   */
  private startLettresFindPhase(): void {
    if (!this.currentQuestion) return;

    this.timeRemaining = GameEngine.LETTRES_FIND_TIME;
    this.io.to(this.room.code).emit("lettres:find_phase", {
      letters: [...this.lettresLetters],
      timeLimit: GameEngine.LETTRES_FIND_TIME,
    });

    // Use standard timer — when it hits 0, endRound() will trigger lettres validation
    this.startTimer();
  }

  /**
   * Start the host validation phase for Lettres
   */
  private startLettresValidation(): void {
    this.lettresValidating = true;
    this.lettresDecisions.clear();
    const activePlayers = this.getActivePlayers();

    // Build player answers list, sorted by word length ascending
    this.lettresPlayerAnswers = activePlayers
      .map((player) => {
        const answer = this.answers.get(player.id);
        const word = (answer?.answer || "").trim().toUpperCase();
        return {
          playerId: player.id,
          playerName: player.name,
          playerAvatar: player.avatar,
          word,
          wordLength: word.length,
        };
      })
      .filter((pa) => pa.wordLength > 0) // exclude empty answers
      .sort((a, b) => a.wordLength - b.wordLength); // ascending by length

    this.io.to(this.room.code).emit("lettres:validation_start", {
      letters: [...this.lettresLetters],
      playerAnswers: this.lettresPlayerAnswers,
    });

    // Auto-validation timeout: 90 seconds
    this.lettresAutoValidationTimer = setTimeout(() => {
      if (this.lettresValidating) {
        // Auto-accept all remaining
        for (const pa of this.lettresPlayerAnswers) {
          if (this.lettresDecisions.has(pa.playerId)) continue;
          this.lettresDecisions.set(pa.playerId, true);
          this.io.to(this.room.code).emit("lettres:answer_result", {
            playerId: pa.playerId,
            playerName: pa.playerName,
            playerAvatar: pa.playerAvatar,
            word: pa.word,
            accepted: true,
          });
        }
        setTimeout(() => {
          this.finalizeLettresFromDecisions();
        }, 1500);
      }
    }, 90000);
  }

  /**
   * Validate a single player's word in Lettres mode
   */
  validateSingleLettresAnswer(playerId: string, accepted: boolean): void {
    if (!this.lettresValidating || !this.currentQuestion) return;
    if (this.lettresDecisions.has(playerId)) return;

    this.lettresDecisions.set(playerId, accepted);

    const pa = this.lettresPlayerAnswers.find((p) => p.playerId === playerId);
    if (!pa) return;

    this.io.to(this.room.code).emit("lettres:answer_result", {
      playerId: pa.playerId,
      playerName: pa.playerName,
      playerAvatar: pa.playerAvatar,
      word: pa.word,
      accepted,
    });

    // Check if all have been reviewed
    const allReviewed = this.lettresPlayerAnswers.every((p) =>
      this.lettresDecisions.has(p.playerId)
    );

    if (allReviewed) {
      setTimeout(() => {
        this.finalizeLettresFromDecisions();
      }, 2000);
    }
  }

  /**
   * Finalize Lettres round from host decisions
   */
  private finalizeLettresFromDecisions(): void {
    if (!this.lettresValidating || !this.currentQuestion) return;
    this.lettresValidating = false;

    if (this.lettresAutoValidationTimer) {
      clearTimeout(this.lettresAutoValidationTimer);
      this.lettresAutoValidationTimer = null;
    }

    const basePoints = this.currentQuestion.points;

    // Find the longest validated word
    let maxLength = 0;
    for (const pa of this.lettresPlayerAnswers) {
      if (this.lettresDecisions.get(pa.playerId) === true) {
        maxLength = Math.max(maxLength, pa.wordLength);
      }
    }

    const scores: { playerId: string; points: number; total: number }[] = [];
    let winner: Player | undefined;

    for (const player of this.room.players) {
      const pa = this.lettresPlayerAnswers.find((p) => p.playerId === player.id);
      const accepted = this.lettresDecisions.get(player.id) === true;
      let points = 0;

      if (accepted && pa && maxLength > 0) {
        // Punitive scoring: (wordLength / maxLength)^2
        const ratio = pa.wordLength / maxLength;
        points = Math.round(basePoints * ratio * ratio);

        // Track winner (longest validated word)
        if (pa.wordLength === maxLength) {
          winner = player;
        }
      }

      // Apply comeback bonus
      if (this.comebackBonusPlayerId === player.id) {
        points *= 2;
      }

      const updatedPlayer = this.updateScore(player.id, points);
      scores.push({
        playerId: player.id,
        points,
        total: updatedPlayer?.score ?? player.score,
      });
    }

    const correctAnswer = this.lettresLetters.join(" ");

    const results: RoundResult = {
      roundNumber: this.currentRound,
      question: this.currentQuestion,
      answers: Array.from(this.answers.values()),
      correctAnswer,
      winner,
      scores,
    };

    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");
    this.updateLoseStreaks(results);
    this.io.to(this.room.code).emit("game:round_end", results);

    if (this.currentTeams) {
      this.processTeamRoundEnd(results.scores);
    }

    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);
      setTimeout(() => {
        this.nextRound();
      }, 2000);
    }, 6000);
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

    // Valise Mystère: resolve immediately on disconnect
    if (this.currentQuestion?.type === "splitsteal" && this.valiseMode) {
      // If voleur disconnects, auto-random choice and resolve
      if (playerId === this.valiseVoleurId && this.valiseVoleurChoice === null) {
        this.resolveValise();
      }
      return;
    }

    // Split or Steal: auto-steal for disconnected, check if all chose
    if (this.currentQuestion?.type === "splitsteal") {
      this.splitStealChoices.set(playerId, "steal");
      if (this.splitStealChoices.size >= activePlayers.length + 1 && activePlayers.length > 0) {
        this.resolveSplitSteal();
      }
      return;
    }

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
    if (this.geoQuizAutoValidationTimer) {
      clearTimeout(this.geoQuizAutoValidationTimer);
      this.geoQuizAutoValidationTimer = null;
    }
    if (this.langueAutoValidationTimer) {
      clearTimeout(this.langueAutoValidationTimer);
      this.langueAutoValidationTimer = null;
    }
    if (this.parcoursAutoValidationTimer) {
      clearTimeout(this.parcoursAutoValidationTimer);
      this.parcoursAutoValidationTimer = null;
    }
    if (this.guessGameAutoValidationTimer) {
      clearTimeout(this.guessGameAutoValidationTimer);
      this.guessGameAutoValidationTimer = null;
    }
    if (this.lettresPickTimer) {
      clearTimeout(this.lettresPickTimer);
      this.lettresPickTimer = null;
    }
    if (this.lettresAutoValidationTimer) {
      clearTimeout(this.lettresAutoValidationTimer);
      this.lettresAutoValidationTimer = null;
    }
  }
}
