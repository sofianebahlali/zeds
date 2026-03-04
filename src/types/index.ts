// ==========================================
// PLAYER TYPES
// ==========================================

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  score: number;
  roundScore: number;
  lastAnswerTime?: number;
}

export type PlayerStatus = "idle" | "ready" | "answering" | "answered" | "disconnected";

// ==========================================
// ROOM TYPES
// ==========================================

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  status: RoomStatus;
  gameMode: GameMode;
  settings: GameSettings;
  currentRound: number;
  totalRounds: number;
  createdAt: number;
}

export type RoomStatus = "waiting" | "starting" | "playing" | "between_rounds" | "finished";

// ==========================================
// GAME TYPES
// ==========================================

export type GameMode = "dictation" | "image" | "qcm" | "open" | "estimation" | "parcours" | "drawing" | "petitbac" | "geoquiz" | "langue" | "maths" | "guessgame";

export interface GameModeConfig {
  mode: GameMode;
  rounds: number;
}

export interface GameSettings {
  maxPlayers: number;
  roundDuration: number; // seconds
  totalRounds: number; // computed from playlist
  showLeaderboardBetweenRounds: boolean;
  difficulty: "easy" | "medium" | "hard";
  playlist: GameModeConfig[];
}

export const DEFAULT_PLAYLIST: GameModeConfig[] = [
  { mode: "qcm", rounds: 3 },
  { mode: "petitbac", rounds: 2 },
  { mode: "estimation", rounds: 3 },
  { mode: "parcours", rounds: 2 },
];

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  maxPlayers: 8,
  roundDuration: 30,
  totalRounds: 10,
  showLeaderboardBetweenRounds: true,
  difficulty: "medium",
  playlist: DEFAULT_PLAYLIST,
};

// ==========================================
// QUESTION TYPES
// ==========================================

export interface BaseQuestion {
  id: string;
  type: GameMode;
  timeLimit: number;
  points: number;
}

export interface DictationQuestion extends BaseQuestion {
  type: "dictation";
  text: string;
  audioFile: string;
  audioText?: string;
  traps?: string[];
  difficulty?: "easy" | "medium" | "hard";
}

export interface ImageQuestion extends BaseQuestion {
  type: "image";
  imageUrl: string;
  answer: string;
  hint?: string;
}

export interface QCMQuestion extends BaseQuestion {
  type: "qcm";
  question: string;
  options: string[];
  correctIndex: number;
}

export interface OpenQuestion extends BaseQuestion {
  type: "open";
  question: string;
  answers: string[]; // Multiple valid answers
  caseSensitive: boolean;
}

export interface EstimationQuestion extends BaseQuestion {
  type: "estimation";
  question: string;
  productName: string;
  imageUrl: string;
  correctValue: number;
  unit: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  source?: string;
}

export interface ParcoursClub {
  name: string;
  years: string;
}

export interface ParcoursQuestion extends BaseQuestion {
  type: "parcours";
  playerName: string;
  clubs: ParcoursClub[];
  acceptedAnswers: string[];
  difficulty: "easy" | "medium" | "hard";
  nationality?: string;
}

export interface DrawingQuestion extends BaseQuestion {
  type: "drawing";
  phrase: string;
  category?: string;
}

export const PETITBAC_CATEGORIES = [
  "Prénom",
  "Pokémon",
  "Joueur de foot",
  "Plat",
  "Métier",
  "Fruit/Légume",
  "Film",
  "Partie du corps/os",
] as const;

export interface GeoQuizQuestion extends BaseQuestion {
  type: "geoquiz";
  imageUrl: string;
  city: string;
  country: string;
  continent: string;
  hint: string; // Usually the country, revealed on hint button
  acceptedAnswers: string[]; // Variations: ["Madrid", "madrid"]
  difficulty: "easy" | "medium" | "hard";
}

export interface GeoQuizPlayerAnswerData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
  usedHint: boolean;
}

export interface GeoQuizValidationData {
  city: string;
  country: string;
  imageUrl: string;
  playerAnswers: GeoQuizPlayerAnswerData[];
}

export interface GeoQuizValidationSubmission {
  validatedPlayerIds: string[];
}

export interface GeoQuizAnswerResultData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
  usedHint: boolean;
  accepted: boolean;
}

export interface PetitBacQuestion extends BaseQuestion {
  type: "petitbac";
  letter: string;
  categories: string[];
}

export interface PetitBacPlayerAnswerData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answers: Record<string, string>;
}

export interface PetitBacValidationData {
  letter: string;
  categories: string[];
  playerAnswers: PetitBacPlayerAnswerData[];
}

export interface PetitBacValidationSubmission {
  validatedAnswers: Record<string, string[]>;
}

export interface LangueQuestion extends BaseQuestion {
  type: "langue";
  sentence: string;
  sentenceTransliteration: string | null;
  targetWord: string;
  targetWordTransliteration: string | null;
  language: string;
  meaning: string;
  acceptedLanguages: string[];
  acceptedMeanings: string[];
  difficulty: "easy" | "medium" | "hard";
  script: "latin" | "non-latin";
  /** @deprecated kept for backward compat with old data */
  word?: string;
}

export interface LanguePlayerAnswerData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  languageAnswer: string;
  meaningAnswer: string;
}

export interface LangueValidationData {
  word: string;
  sentence: string;
  sentenceTransliteration: string | null;
  targetWord: string;
  targetWordTransliteration: string | null;
  script: "latin" | "non-latin";
  correctLanguage: string;
  correctMeaning: string;
  playerAnswers: LanguePlayerAnswerData[];
}

export interface LangueValidationSubmission {
  results: {
    playerId: string;
    languageCorrect: boolean;
    meaningCorrect: boolean;
  }[];
}

export interface LangueAnswerResultData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  languageAnswer: string;
  meaningAnswer: string;
  languageCorrect: boolean;
  meaningCorrect: boolean;
}

export interface MathsQuestion extends BaseQuestion {
  type: "maths";
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface GuessGameQuestion extends BaseQuestion {
  type: "guessgame";
  imageUrl: string;
  gameTitle: string;
  acceptedAnswers: string[];
  genre?: string;
  releaseYear?: number;
  developer?: string;
  difficulty: "easy" | "medium" | "hard";
}

export type Question = DictationQuestion | ImageQuestion | QCMQuestion | OpenQuestion | EstimationQuestion | ParcoursQuestion | DrawingQuestion | PetitBacQuestion | GeoQuizQuestion | LangueQuestion | MathsQuestion | GuessGameQuestion;

// ==========================================
// ANSWER TYPES
// ==========================================

export interface Answer {
  playerId: string;
  questionId: string;
  answer: string;
  timestamp: number;
  isCorrect?: boolean;
  points?: number;
  responseTime?: number;
}

// ==========================================
// ROUND TYPES
// ==========================================

export interface RoundResult {
  roundNumber: number;
  question: Question;
  answers: Answer[];
  correctAnswer: string;
  winner?: Player;
  scores: { playerId: string; points: number; total: number }[];
}

// ==========================================
// DRAWING MODE TYPES
// ==========================================

export type DrawingPhase = "suggesting" | "drawing" | "guessing" | "revealing";

export interface DrawingPhaseData {
  phase: DrawingPhase;
  timeLimit: number;
  totalPlayers: number;
}

export interface DrawingChain {
  suggesterId: string;
  suggesterName: string;
  suggesterAvatar: string;
  artistId: string;
  artistName: string;
  artistAvatar: string;
  phrase: string;
  drawingData: string;
  guesserId: string;
  guesserName: string;
  guesserAvatar: string;
  guess: string;
  isGuessCorrect: boolean;
}

export interface DrawingRevealState {
  chains: DrawingChain[];
  currentChainIndex: number;
  currentStep: number; // 0=phrase, 1=drawing, 2=guess, 3=verdict
}

export interface DrawingScoreBreakdown {
  drawingGuessedByOther: boolean;
  youGuessedCorrectly: boolean;
  totalForRound: number;
}

export interface DrawingRoundResult {
  roundNumber: number;
  chains: DrawingChain[];
  scores: { playerId: string; points: number; total: number; breakdown: DrawingScoreBreakdown }[];
}

// ==========================================
// GAME STATE TYPES
// ==========================================

export interface GameState {
  status: "idle" | "question" | "answering" | "revealing" | "leaderboard" | "finished";
  currentQuestion?: Question;
  timeRemaining: number;
  roundResults?: RoundResult;
  playerAnswers: Map<string, Answer>;
}

// ==========================================
// SOCKET EVENT TYPES
// ==========================================

export interface ServerToClientEvents {
  // Room events
  "room:joined": (room: Room, player: Player) => void;
  "room:player_joined": (player: Player) => void;
  "room:player_left": (playerId: string) => void;
  "room:player_ready": (playerId: string, isReady: boolean) => void;
  "room:settings_updated": (settings: GameSettings) => void;
  "room:host_changed": (newHostId: string) => void;
  "room:error": (message: string) => void;

  // Game events
  "game:mode_changed": (mode: GameMode) => void;
  "game:starting": (countdown: number) => void;
  "game:round_start": (round: number, question: Question) => void;
  "game:time_update": (timeRemaining: number) => void;
  "game:player_answered": (playerId: string) => void;
  "game:round_end": (result: RoundResult) => void;
  "game:leaderboard": (players: Player[]) => void;
  "game:finished": (finalScores: Player[]) => void;

  // Drawing events
  "drawing:phase_start": (phase: DrawingPhase, data: DrawingPhaseData) => void;
  "drawing:your_phrase": (phrase: string, questionId: string) => void;
  "drawing:your_guess_target": (drawingData: string) => void;
  "drawing:reveal_state": (revealState: DrawingRevealState) => void;
  "drawing:reveal_step": (chainIndex: number, step: number) => void;
  "drawing:round_scores": (result: DrawingRoundResult) => void;

  // Petit Bac events
  "petitbac:validation_start": (data: PetitBacValidationData) => void;
  "petitbac:validation_result": (validation: PetitBacValidationSubmission) => void;

  // GeoQuiz events
  "geoquiz:validation_start": (data: GeoQuizValidationData) => void;
  "geoquiz:validation_result": (validation: GeoQuizValidationSubmission) => void;
  "geoquiz:hint_revealed": (hint: string) => void;
  "geoquiz:answer_result": (data: GeoQuizAnswerResultData) => void;

  // Langue events
  "langue:validation_start": (data: LangueValidationData) => void;
  "langue:validation_result": (validation: LangueValidationSubmission) => void;
  "langue:answer_result": (data: LangueAnswerResultData) => void;

  // Connection events
  "connection:reconnected": (room: Room, player: Player) => void;
  "connection:player_disconnected": (playerId: string) => void;
  "connection:player_reconnected": (playerId: string) => void;
}

export interface ClientToServerEvents {
  // Room events
  "room:create": (playerName: string, avatar: string) => void;
  "room:join": (roomCode: string, playerName: string, avatar: string) => void;
  "room:leave": () => void;
  "room:ready": (isReady: boolean) => void;
  "room:update_settings": (settings: Partial<GameSettings>) => void;
  "room:kick_player": (playerId: string) => void;
  "room:change_game_mode": (mode: GameMode) => void;

  // Game events
  "game:start": () => void;
  "game:submit_answer": (answer: string) => void;
  "game:request_next_round": () => void;

  // Drawing events
  "drawing:submit_suggestion": (suggestion: string) => void;
  "drawing:submit_drawing": (drawingBase64: string) => void;
  "drawing:submit_guess": (guess: string) => void;
  "drawing:reveal_next": () => void;
  "drawing:reveal_prev": () => void;

  // Petit Bac events
  "petitbac:submit_validation": (validation: PetitBacValidationSubmission) => void;

  // GeoQuiz events
  "geoquiz:submit_validation": (validation: GeoQuizValidationSubmission) => void;
  "geoquiz:validate_answer": (playerId: string, accepted: boolean) => void;
  "geoquiz:use_hint": () => void;

  // Langue events
  "langue:submit_validation": (validation: LangueValidationSubmission) => void;
  "langue:validate_answer": (playerId: string, languageCorrect: boolean, meaningCorrect: boolean) => void;

  // Connection events
  "connection:reconnect": (roomCode: string, playerId: string) => void;
}

// ==========================================
// UI STATE TYPES
// ==========================================

export type Screen =
  | "home"
  | "create"
  | "join"
  | "lobby"
  | "game"
  | "scoreboard"
  | "error"
  | "reconnecting";

export interface UIState {
  currentScreen: Screen;
  isLoading: boolean;
  error: string | null;
  notification: Notification | null;
}

export interface Notification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

// ==========================================
// AVATAR OPTIONS
// ==========================================

export const AVATARS = [
  "🦊", "🐼", "🦁", "🐯", "🐨", "🐸", "🦄", "🐙",
  "🦋", "🐝", "🦜", "🦩", "🐳", "🦈", "🐬", "🦑",
  "🐲", "🦖", "🦕", "🐢", "🐍", "🦎", "🐅", "🐆",
] as const;

export type Avatar = typeof AVATARS[number];

// ==========================================
// GAME MODE INFO
// ==========================================

export interface GameModeInfo {
  id: GameMode;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const GAME_MODES: GameModeInfo[] = [
  {
    id: "dictation",
    name: "Dictée",
    description: "Écoute et écris ce que tu entends",
    icon: "🎧",
    color: "from-brand-500 to-brand-700",
  },
  {
    id: "image",
    name: "Image",
    description: "Devine ce que représente l'image",
    icon: "🖼️",
    color: "from-accent-500 to-accent-700",
  },
  {
    id: "qcm",
    name: "QCM",
    description: "Choisis la bonne réponse parmi 4",
    icon: "📝",
    color: "from-success-500 to-success-700",
  },
  {
    id: "open",
    name: "Question ouverte",
    description: "Réponds librement à la question",
    icon: "💬",
    color: "from-warning-500 to-warning-700",
  },
  {
    id: "estimation",
    name: "Le Juste Prix",
    description: "Devine le prix de l'objet",
    icon: "💰",
    color: "from-emerald-500 to-emerald-700",
  },
  {
    id: "parcours",
    name: "Parcours",
    description: "Devine le joueur à partir de ses clubs",
    icon: "⚽",
    color: "from-green-500 to-green-700",
  },
  {
    id: "drawing",
    name: "Dessine-moi",
    description: "Suggère, dessine et devine !",
    icon: "🎨",
    color: "from-purple-500 to-purple-700",
  },
  {
    id: "petitbac",
    name: "Petit Bac",
    description: "Trouve des mots commençant par la lettre imposée",
    icon: "🔤",
    color: "from-cyan-500 to-cyan-700",
  },
  {
    id: "geoquiz",
    name: "GeoQuiz",
    description: "Reconnais le lieu et trouve la ville",
    icon: "🌍",
    color: "from-sky-500 to-sky-700",
  },
  {
    id: "langue",
    name: "Devine la Langue",
    description: "Devine la langue et la signification du mot",
    icon: "🗣️",
    color: "from-rose-500 to-rose-700",
  },
  {
    id: "maths",
    name: "Maths",
    description: "Résous le problème — attention aux pièges !",
    icon: "🧮",
    color: "from-indigo-500 to-indigo-700",
  },
  {
    id: "guessgame",
    name: "Guess the Game",
    description: "Devine le jeu vidéo à partir du screenshot",
    icon: "🎮",
    color: "from-violet-500 to-violet-700",
  },
];
