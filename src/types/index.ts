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
  loseStreak: number;
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

export type GameMode = "dictation" | "image" | "qcm" | "open" | "estimation" | "parcours" | "drawing" | "petitbac" | "geoquiz" | "langue" | "maths" | "guessgame" | "lineup" | "jerseynumber" | "futcard" | "chrono" | "consensus" | "splitsteal" | "liste" | "pokestats" | "pokemon" | "dialed" | "pokegeo" | "pokemontranslate";

export interface GameModeConfig {
  mode: GameMode;
  rounds: number;
  pokestatsGenerations?: number[]; // Filter by generation(s) for pokestats mode
  pokemonGenerations?: number[]; // Filter by generation(s) for pokemon silhouette mode
  pokemonTranslateGenerations?: number[]; // Filter by generation(s) for pokemon translate mode
}

export interface GameSettings {
  maxPlayers: number;
  roundDuration: number; // seconds
  totalRounds: number; // computed from playlist
  showLeaderboardBetweenRounds: boolean;
  hideScoresBetweenRounds: boolean;
  shufflePlaylist: boolean;
  difficulty: "easy" | "medium" | "hard";
  playlist: GameModeConfig[];
  teamRoundsEnabled: boolean;
}

// ==========================================
// TEAM TYPES
// ==========================================

export interface TeamInfo {
  id: "blue" | "red";
  name: string;
  playerIds: string[];
}

export interface TeamRoundData {
  teams: TeamInfo[];
  burstRoundsRemaining: number;
}

export interface TeamRoundResult {
  teams: { teamId: "blue" | "red"; teamName: string; totalPoints: number; playerIds: string[] }[];
  winningTeamId: "blue" | "red" | "tie";
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
  hideScoresBetweenRounds: false,
  shufflePlaylist: false,
  difficulty: "medium",
  playlist: DEFAULT_PLAYLIST,
  teamRoundsEnabled: false,
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

export const PETITBAC_ALL_CATEGORIES = [
  "Prénom",
  "Pokémon",
  "Joueur de foot",
  "Plat",
  "Métier",
  "Fruit/Légume",
  "Film",
  "Partie du corps/os",
  "Capitale",
  "Célébrité (non footballeur)",
  "Président/Dirigeant de pays",
  "Personnage de Manga",
  "Jeu vidéo",
  "Marque",
  "Chose qu'on ne peut pas acheter",
  "Arme sur COD",
  "Unité de mesure",
  "Monument",
  "Antagoniste (hors manga)",
  "Défaut",
] as const;

export const PETITBAC_CATEGORIES_PER_ROUND = 8;

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

// ==========================================
// POKEGEO (Pokémon GeoGuessr) TYPES
// ==========================================

export interface PokeGeoQuestion extends BaseQuestion {
  type: "pokegeo";
  imageUrl: string;
  location: string; // e.g. "Bourg Palette", "Route 1"
  game: string; // e.g. "Pokémon Rouge/Bleu", "Pokémon Or/Argent"
  region: string; // e.g. "Kanto", "Johto"
  hint: string; // Usually the region or game, revealed on hint button
  acceptedAnswers: string[];
  difficulty: "easy" | "medium" | "hard";
}

export interface PokeGeoPlayerAnswerData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
  usedHint: boolean;
}

export interface PokeGeoValidationData {
  location: string;
  game: string;
  region: string;
  imageUrl: string;
  playerAnswers: PokeGeoPlayerAnswerData[];
}

export interface PokeGeoValidationSubmission {
  validatedPlayerIds: string[];
}

export interface PokeGeoAnswerResultData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
  usedHint: boolean;
  accepted: boolean;
}

// ==========================================
// PARCOURS VALIDATION TYPES
// ==========================================

export interface ParcoursPlayerAnswerData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
}

export interface ParcoursValidationData {
  clubs: ParcoursClub[];
  playerAnswers: ParcoursPlayerAnswerData[];
  correctAnswer: string;
}

export interface ParcoursValidationSubmission {
  validatedPlayerIds: string[];
}

export interface ParcoursAnswerResultData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
  accepted: boolean;
}

// ==========================================
// GUESS GAME VALIDATION TYPES
// ==========================================

export interface GuessGamePlayerAnswerData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
}

export interface GuessGameValidationData {
  gameTitle: string;
  imageUrl: string;
  playerAnswers: GuessGamePlayerAnswerData[];
}

export interface GuessGameValidationSubmission {
  validatedPlayerIds: string[];
}

export interface GuessGameAnswerResultData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
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

// ==========================================
// LINEUP MODE TYPES
// ==========================================

export interface JerseyNumberQuestion extends BaseQuestion {
  type: "jerseynumber";
  playerName: string;
  team: string;
  position: string;
  correctNumber: number;
  league?: string;
  nationality?: string;
  difficulty: "easy" | "medium" | "hard";
}

export type FutCardType =
  | "gold_rare"
  | "icon"
  | "toty"
  | "tots"
  | "totw"
  | "headliners"
  | "future_stars"
  | "sbc"
  | "flashback"
  | "eoae"
  | "potm"
  | "fut_birthday"
  | "futties"
  | "rulebreakers"
  | "record_breaker"
  | "hero"
  | "winter_wildcards"
  | "showdown"
  | "objetivos"
  | "otw";

export interface FutCardStats {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

export interface FutCardQuestion extends BaseQuestion {
  type: "futcard";
  playerName: string;
  acceptedAnswers: string[];
  cardType: FutCardType;
  fifaEdition: string;
  rating: number;
  position: string;
  nationality: string;
  club: string;
  stats: FutCardStats;
  difficulty: "easy" | "medium" | "hard";
}

export interface ChronoQuestion extends BaseQuestion {
  type: "chrono";
  targetDuration: number; // in milliseconds (e.g., 5000)
  label: string; // e.g., "5 secondes"
  difficulty: "easy" | "medium" | "hard";
}

export interface ConsensusQuestion extends BaseQuestion {
  type: "consensus";
  prompt: string; // e.g., "Citez un fruit rouge"
  category: string; // e.g., "Nourriture"
  difficulty: "easy" | "medium" | "hard";
}

export interface ConsensusPlayerAnswerData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
}

export interface ConsensusValidationData {
  prompt: string;
  category: string;
  playerAnswers: ConsensusPlayerAnswerData[];
}

export interface ConsensusValidationSubmission {
  validatedPlayerIds: string[];
}

export interface ConsensusAnswerResultData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
  accepted: boolean;
}

export interface SplitStealQuestion extends BaseQuestion {
  type: "splitsteal";
}

export interface DialedQuestion extends BaseQuestion {
  type: "dialed";
  targetH: number; // Hue 0-360
  targetS: number; // Saturation 0-100
  targetL: number; // Lightness 0-100
  memorizeDuration: number; // seconds to show color before hiding
}

// ==========================================
// LISTE MODE TYPES
// ==========================================

export interface ListeItem {
  answer: string;
  aliases: string[];
  hint?: string;
}

export interface ListeQuestion extends BaseQuestion {
  type: "liste";
  title: string;
  quizId: string;
  category: string;
  subcategory: string;
  difficulty: "easy" | "medium" | "hard" | "very-hard";
  items: ListeItem[];
}

export interface ListeFoundItem {
  index: number;
  answer: string;
  foundBy: string;
  foundAt: number; // timestamp
}

export interface ListePlayerState {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  foundItems: number[];
  hasFinished: boolean;
}

export interface ListeProgressData {
  foundItems: ListeFoundItem[];
  playerStates: ListePlayerState[];
  totalItems: number;
}

export interface ListeRoundResult {
  roundNumber: number;
  quizTitle: string;
  items: ListeItem[];
  playerResults: {
    playerId: string;
    playerName: string;
    playerAvatar: string;
    foundCount: number;
    points: number;
    total: number;
    foundItems: number[];
    completionBonus: boolean;
  }[];
}

// ==========================================
// POKEMON STATS MODE TYPES
// ==========================================

export interface PokemonStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface PokemonStatsQuestion extends BaseQuestion {
  type: "pokestats";
  pokemonId: number;
  nameEn: string;
  nameFr: string;
  aliases: string[];
  generation: number;
  types: string[];
  typesFr: string[];
  stats: PokemonStats;
  abilities: string[];
  abilitiesFr: string[];
}

export interface PokestatsGuessResult {
  correct: boolean;
  hintsUsed: number;
  points?: number;
}

export interface PokestatsHintData {
  hintLevel: number;
  hintType: "type1" | "type2" | "generation" | "ability";
  value: string;
  valueFr: string;
  hintsRemaining: number;
}

export interface PokestatsRoundResult {
  roundNumber: number;
  pokemonId: number;
  nameEn: string;
  nameFr: string;
  stats: PokemonStats;
  types: string[];
  typesFr: string[];
  generation: number;
  abilities: string[];
  abilitiesFr: string[];
  playerResults: {
    playerId: string;
    playerName: string;
    playerAvatar: string;
    found: boolean;
    hintsUsed: number;
    points: number;
    total: number;
  }[];
}

export interface PokestatsAbandonResult {
  nameFr: string;
  nameEn: string;
  pokemonId: number;
  types: string[];
  typesFr: string[];
  generation: number;
  abilities: string[];
  abilitiesFr: string[];
}

// ==========================================
// POKEMON SILHOUETTE MODE TYPES
// ==========================================

export interface PokemonSilhouetteQuestion extends BaseQuestion {
  type: "pokemon";
  pokemonId: number;
  imageUrl: string;
  nameEn: string;
  nameFr: string;
  aliases: string[];
  generation: number;
  types: string[];
  typesFr: string[];
}

export interface PokemonPlayerAnswerData {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: string;
}

export interface PokemonValidationData {
  nameFr: string;
  nameEn: string;
  imageUrl: string;
  playerAnswers: PokemonPlayerAnswerData[];
}

export interface PokemonGuessResult {
  correct: boolean;
  points?: number;
  isFirst?: boolean;
}

export interface PokemonRoundResult {
  roundNumber: number;
  pokemonId: number;
  nameEn: string;
  nameFr: string;
  imageUrl: string;
  types: string[];
  typesFr: string[];
  generation: number;
  playerResults: {
    playerId: string;
    playerName: string;
    playerAvatar: string;
    found: boolean;
    points: number;
    total: number;
    isFirst: boolean;
  }[];
}

export interface PokemonAbandonResult {
  nameFr: string;
  nameEn: string;
  pokemonId: number;
  imageUrl: string;
  types: string[];
  typesFr: string[];
  generation: number;
}

// ==========================================
// POKEMON TRANSLATE MODE TYPES
// ==========================================

export interface PokemonTranslateQuestion extends BaseQuestion {
  type: "pokemontranslate";
  pokemonId: number;
  nameFr: string;
  nameEn: string;
  nameDe: string;
  nameJa: string;
  generation: number;
}

export interface LineupPlayer {
  pos: string;
  name: string;
  num: number;
  alt: string[];
}

export interface LineupTeam {
  name: string;
  flag: string;
  formation: string;
  players: LineupPlayer[];
}

export interface LineupMatch {
  id: string;
  competition: string;
  date: string;
  score: string;
  team1: LineupTeam;
  team2: LineupTeam;
}

export interface LineupQuestion extends BaseQuestion {
  type: "lineup";
  match: LineupMatch;
}

export interface LineupGuessResult {
  playerId: string;
  correct: boolean;
  teamSide?: 1 | 2;
  playerIndex?: number;
  displayName?: string;
  foundCount: number;
  totalPlayers: number;
}

export type Question = DictationQuestion | ImageQuestion | QCMQuestion | OpenQuestion | EstimationQuestion | ParcoursQuestion | DrawingQuestion | PetitBacQuestion | GeoQuizQuestion | LangueQuestion | MathsQuestion | GuessGameQuestion | LineupQuestion | JerseyNumberQuestion | FutCardQuestion | ChronoQuestion | ConsensusQuestion | SplitStealQuestion | ListeQuestion | PokemonStatsQuestion | PokemonSilhouetteQuestion | DialedQuestion | PokeGeoQuestion | PokemonTranslateQuestion;

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
  isGuessCorrect: boolean | null;
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
// SPLIT OR STEAL TYPES
// ==========================================

export interface SplitStealStartData {
  pairingType: "pair" | "cycle";
  targetId: string;
  targetName: string;
  targetAvatar: string;
  incomingId?: string;
  incomingName?: string;
  incomingAvatar?: string;
  timeLimit: number;
}

export interface SplitStealChoiceEntry {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  choice: "split" | "steal";
  targetPlayerId: string;
}

export interface SplitStealRevealData {
  pairingType: "pair" | "cycle";
  choices: SplitStealChoiceEntry[];
  playerScores: { playerId: string; points: number; isCenterOfSteals: boolean }[];
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
  "drawing:chain_validated": (chainIndex: number, accepted: boolean) => void;

  // Consensus events
  "consensus:validation_start": (data: ConsensusValidationData) => void;
  "consensus:answer_result": (data: ConsensusAnswerResultData) => void;

  // Petit Bac events
  "petitbac:validation_start": (data: PetitBacValidationData) => void;
  "petitbac:validation_result": (validation: PetitBacValidationSubmission) => void;
  "petitbac:stop_triggered": (data: { playerId: string; playerName: string; countdown: number }) => void;

  // GeoQuiz events
  "geoquiz:validation_start": (data: GeoQuizValidationData) => void;
  "geoquiz:validation_result": (validation: GeoQuizValidationSubmission) => void;
  "geoquiz:hint_revealed": (hint: string) => void;
  "geoquiz:answer_result": (data: GeoQuizAnswerResultData) => void;

  // PokéGeo events
  "pokegeo:validation_start": (data: PokeGeoValidationData) => void;
  "pokegeo:validation_result": (validation: PokeGeoValidationSubmission) => void;
  "pokegeo:hint_revealed": (hint: string) => void;
  "pokegeo:answer_result": (data: PokeGeoAnswerResultData) => void;

  // Langue events
  "langue:validation_start": (data: LangueValidationData) => void;
  "langue:validation_result": (validation: LangueValidationSubmission) => void;
  "langue:answer_result": (data: LangueAnswerResultData) => void;

  // Parcours events
  "parcours:validation_start": (data: ParcoursValidationData) => void;
  "parcours:validation_result": (validation: ParcoursValidationSubmission) => void;
  "parcours:answer_result": (data: ParcoursAnswerResultData) => void;

  // GuessGame events
  "guessgame:validation_start": (data: GuessGameValidationData) => void;
  "guessgame:validation_result": (validation: GuessGameValidationSubmission) => void;
  "guessgame:answer_result": (data: GuessGameAnswerResultData) => void;

  // Lineup events
  "lineup:guess_result": (result: LineupGuessResult) => void;
  "lineup:reveal": (match: LineupMatch, scores: { playerId: string; foundCount: number }[]) => void;

  // Split or Steal events
  "splitsteal:phase_start": (data: SplitStealStartData) => void;
  "splitsteal:player_chose": (playerId: string) => void;
  "splitsteal:reveal": (data: SplitStealRevealData) => void;

  // Liste events
  "liste:item_found": (data: { playerId: string; itemIndex: number; answer: string }) => void;
  "liste:player_finished": (data: { playerId: string; finishedCount: number; totalPlayers: number }) => void;
  "liste:progress": (data: ListeProgressData) => void;
  "liste:round_end": (result: ListeRoundResult) => void;

  // Pokemon Stats events
  "pokestats:guess_result": (result: PokestatsGuessResult) => void;
  "pokestats:hint": (data: PokestatsHintData) => void;
  "pokestats:round_end": (result: PokestatsRoundResult) => void;
  "pokestats:player_found": (data: { playerId: string; hintsUsed: number }) => void;
  "pokestats:abandon_result": (data: PokestatsAbandonResult) => void;

  // Pokemon Silhouette events
  "pokemon:guess_result": (result: PokemonGuessResult) => void;
  "pokemon:round_end": (result: PokemonRoundResult) => void;
  "pokemon:player_found": (data: { playerId: string; isFirst: boolean }) => void;
  "pokemon:abandon_result": (data: PokemonAbandonResult) => void;
  "pokemon:validation_start": (data: PokemonValidationData) => void;
  "pokemon:answer_result": (data: { playerId: string; playerName: string; playerAvatar: string; answer: string; accepted: boolean }) => void;

  // Team events
  "game:team_round_start": (data: TeamRoundData) => void;
  "game:team_round_end": (result: TeamRoundResult) => void;

  // Room play again
  "room:play_again": (room: Room) => void;

  // Connection events
  "connection:reconnected": (room: Room, player: Player) => void;
  "connection:player_disconnected": (playerId: string) => void;
  "connection:player_reconnected": (playerId: string) => void;

  // Chat events
  "chat:message": (message: ChatMessage) => void;

  // Reaction events
  "reaction:laugh": (reaction: AnswerReaction) => void;
}

export interface ClientToServerEvents {
  // Room events
  "room:create": (playerName: string, avatar: string, playerId: string) => void;
  "room:join": (roomCode: string, playerName: string, avatar: string, playerId: string) => void;
  "room:play_again": () => void;
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
  "drawing:validate_chain": (chainIndex: number, accepted: boolean) => void;

  // Consensus events
  "consensus:validate_answer": (playerId: string, accepted: boolean) => void;

  // Petit Bac events
  "petitbac:submit_validation": (validation: PetitBacValidationSubmission) => void;

  // GeoQuiz events
  "geoquiz:submit_validation": (validation: GeoQuizValidationSubmission) => void;
  "geoquiz:validate_answer": (playerId: string, accepted: boolean) => void;
  "geoquiz:use_hint": () => void;

  // PokéGeo events
  "pokegeo:submit_validation": (validation: PokeGeoValidationSubmission) => void;
  "pokegeo:validate_answer": (playerId: string, accepted: boolean) => void;
  "pokegeo:use_hint": () => void;

  // Langue events
  "langue:submit_validation": (validation: LangueValidationSubmission) => void;
  "langue:validate_answer": (playerId: string, languageCorrect: boolean, meaningCorrect: boolean) => void;

  // Parcours events
  "parcours:validate_answer": (playerId: string, accepted: boolean) => void;

  // GuessGame events
  "guessgame:validate_answer": (playerId: string, accepted: boolean) => void;

  // Lineup events
  "lineup:skip_reveal": () => void;

  // Split or Steal events
  "splitsteal:submit_choice": (choice: "split" | "steal") => void;

  // Liste events
  "liste:submit_answer": (answer: string) => void;
  "liste:finish": () => void;

  // Pokemon Stats events
  "pokestats:use_hint": () => void;
  "pokestats:abandon": () => void;

  // Pokemon Silhouette events
  "pokemon:abandon": () => void;
  "pokemon:validate_answer": (playerId: string, accepted: boolean) => void;

  // Connection events
  "connection:reconnect": (roomCode: string, playerId: string) => void;

  // Chat events
  "chat:send_message": (message: string) => void;

  // Reaction events
  "reaction:laugh": (targetPlayerId: string, roundNumber: number) => void;
}

// ==========================================
// CHAT & REACTIONS
// ==========================================

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerAvatar: string;
  message: string;
  timestamp: number;
}

export interface AnswerReaction {
  playerId: string;
  playerName: string;
  targetPlayerId: string;
  roundNumber: number;
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
  {
    id: "lineup",
    name: "Compos",
    description: "Retrouve les 22 joueurs d'un match mythique",
    icon: "⚽",
    color: "from-lime-500 to-lime-700",
  },
  {
    id: "jerseynumber",
    name: "Devine le Numéro",
    description: "Quel est le numéro de maillot de ce joueur ?",
    icon: "👕",
    color: "from-teal-500 to-teal-700",
  },
  {
    id: "futcard",
    name: "Devine la Carte FUT",
    description: "Devine le joueur à partir de sa carte FUT",
    icon: "🃏",
    color: "from-yellow-500 to-amber-700",
  },
  {
    id: "chrono",
    name: "Chronomètre",
    description: "Mesure le temps sans regarder !",
    icon: "⏱️",
    color: "from-orange-500 to-red-700",
  },
  {
    id: "consensus",
    name: "Consensus",
    description: "Pense comme les autres !",
    icon: "🤝",
    color: "from-pink-500 to-fuchsia-700",
  },
  {
    id: "splitsteal",
    name: "Split or Steal",
    description: "Partage ou vole les points !",
    icon: "💎",
    color: "from-amber-500 to-red-700",
  },
  {
    id: "liste",
    name: "Liste Football",
    description: "Nomme un max d'éléments de la liste !",
    icon: "⚽",
    color: "from-green-500 to-emerald-700",
  },
  {
    id: "pokestats",
    name: "Pokémon Stats",
    description: "Devine le Pokémon à partir de ses stats !",
    icon: "⚡",
    color: "from-yellow-400 to-red-500",
  },
  {
    id: "pokemon",
    name: "Quel est ce Pokémon ?",
    description: "Devine le Pokémon à partir de sa silhouette !",
    icon: "❓",
    color: "from-purple-500 to-indigo-700",
  },
  {
    id: "dialed",
    name: "Devine la couleur",
    description: "Mémorise la couleur puis reproduis-la avec les sliders !",
    icon: "🎨",
    color: "from-fuchsia-500 to-violet-700",
  },
  {
    id: "pokegeo",
    name: "PokéGeo",
    description: "Reconnais le lieu dans le jeu Pokémon !",
    icon: "🗺️",
    color: "from-red-500 to-yellow-500",
  },
  {
    id: "pokemontranslate",
    name: "Traduis le Pokémon",
    description: "Devine le nom français du Pokémon !",
    icon: "🌐",
    color: "from-blue-500 to-green-500",
  },
];
