/**
 * Seed script for importing OpenQuizzDB questions into SQLite
 *
 * Usage:
 *   npx tsx scripts/seed-questions.ts [path-to-openquizzdb-data]
 *
 * Default path: /tmp/openquizzdb/data
 * To get the data: git clone https://github.com/Zeuh/OpenQuizzDB.git /tmp/openquizzdb
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

// ==========================================
// THEME MAPPING
// ==========================================

// Map OpenQuizzDB themes (French, very specific) to our unified themes
const THEME_MAP: Record<string, string> = {
  // Culture générale
  "culture générale": "Culture générale",
  "culture internationale": "Culture générale",
  "culture en vrac": "Culture générale",
  "culture et personnalités": "Culture générale",
  "culture jeune": "Culture générale",
  incollable: "Culture générale",
  "questions de nombres": "Culture générale",
  "trouvez le nombre": "Culture générale",
  "unités de mesure": "Culture générale",
  "expressions connues": "Culture générale",
  "haut en couleur": "Culture générale",
  couleurs: "Culture générale",
  "marques, logos et slogans": "Culture générale",
  inventions: "Culture générale",
  "objets et instruments": "Culture générale",
  "faits de société": "Culture générale",
  "moyens de transport": "Culture générale",
  automobile: "Culture générale",
  "constructeurs automobiles": "Culture générale",
  "crypto-monnaies": "Culture générale",
  "orthoquizz": "Culture générale",
  "mots croisés": "Culture générale",
  "franglais du net": "Culture générale",

  // Cinéma & Séries
  cinéma: "Cinéma & Séries",
  "comédies au cinéma": "Cinéma & Séries",
  "comédies françaises": "Cinéma & Séries",
  "petits secrets du cinéma": "Cinéma & Séries",
  "belles du cinéma": "Cinéma & Séries",
  "robots du cinéma": "Cinéma & Séries",
  "couples mythiques du cinéma": "Cinéma & Séries",
  "réalisatrices françaises": "Cinéma & Séries",
  "cérémonie des césar": "Cinéma & Séries",
  "séries américaines": "Cinéma & Séries",
  "feuilletons télévisés": "Cinéma & Séries",
  "télé-réalité": "Cinéma & Séries",
  "secret story": "Cinéma & Séries",
  "animateurs télé en france": "Cinéma & Séries",
  "jeunesse et dessins animés": "Cinéma & Séries",
  // Specific movies/shows
  "star wars": "Cinéma & Séries",
  "héros de star wars": "Cinéma & Séries",
  "game of thrones": "Cinéma & Séries",
  "breaking bad": "Cinéma & Séries",
  "hunger games": "Cinéma & Séries",
  "jurassic park": "Cinéma & Séries",
  "toy story a 20 ans": "Cinéma & Séries",
  "le roi lion": "Cinéma & Séries",
  "le grand bleu": "Cinéma & Séries",
  "le cinquième élément": "Cinéma & Séries",
  "bob l'éponge": "Cinéma & Séries",
  "les visiteurs": "Cinéma & Séries",
  "la casa de papel": "Cinéma & Séries",
  "x-files : la série": "Cinéma & Séries",
  "alien : la saga": "Cinéma & Séries",
  "star trek": "Cinéma & Séries",
  "fiction pour tous": "Cinéma & Séries",
  "princesses disney": "Cinéma & Séries",
  "personnages imaginaires": "Cinéma & Séries",
  "dragons hier et aujourd'hui": "Cinéma & Séries",
  // Actors/Directors
  "clint eastwood": "Cinéma & Séries",
  "bruce willis": "Cinéma & Séries",
  "sophie marceau": "Cinéma & Séries",
  "steven spielberg": "Cinéma & Séries",
  "brad pitt au cinéma": "Cinéma & Séries",
  "marilyn monroe": "Cinéma & Séries",
  "charlize theron": "Cinéma & Séries",

  // Musique
  musique: "Musique",
  "instruments de musique": "Musique",
  "variété française": "Musique",
  "chanteurs internationaux": "Musique",
  "le reggae": "Musique",
  "la new wave": "Musique",
  "acid jazz": "Musique",
  "tubes disco": "Musique",
  "groupes eighties": "Musique",
  "artistes electro": "Musique",
  "depeche mode": "Musique",
  "the cure": "Musique",
  "jean michel jarre": "Musique",
  "france gall": "Musique",
  "johnny hallyday": "Musique",

  // Sport
  sport: "Sport",
  "sports pour tous": "Sport",
  "sports collectifs": "Sport",
  "sports d'hiver": "Sport",
  "jeux olympiques": "Sport",
  "rio 2016": "Sport",
  "pyeongchang 2018": "Sport",
  tennis: "Sport",
  "sur le court": "Sport",
  boxe: "Sport",
  haltérophilie: "Sport",
  escalade: "Sport",
  golf: "Sport",
  "nba : joueurs et franchises": "Sport",
  ironman: "Sport",
  "maria sharapova": "Sport",
  "john mcenroe": "Sport",
  // Football
  "foot dantan": "Sport",
  "foot 1990-2000": "Sport",
  "foot 2000-2010": "Sport",
  "foot 2010-2020": "Sport",
  "russia 2018": "Sport",
  "stades de ligue 1": "Sport",
  "fc barcelone": "Sport",
  wags: "Sport",
  "mike horn": "Sport",
  "grandes randonnées": "Sport",

  // Histoire
  histoire: "Histoire",
  "histoire de france": "Histoire",
  "histoire politique": "Histoire",
  "grandes dates du 20e siècle": "Histoire",
  "guerres et batailles": "Histoire",
  "gladiateurs": "Histoire",
  "châteaux et châteaux forts": "Histoire",
  "peuples du monde": "Histoire",
  "égypte ancienne": "Histoire",
  toutânkhamon: "Histoire",
  "machu picchu": "Histoire",
  teotihuacan: "Histoire",
  "nikola tesla": "Histoire",
  "alan turing": "Histoire",

  // Géographie
  géographie: "Géographie",
  "géo pour tous": "Géographie",
  "villes du monde": "Géographie",
  "surnoms des villes": "Géographie",
  "sites touristiques": "Géographie",
  "monuments du monde": "Géographie",
  "ponts tout en longueur": "Géographie",
  "méditerranée": "Géographie",
  "l'appel du large": "Géographie",
  "histoires d'eaux": "Géographie",
  "la durance": "Géographie",
  antarctique: "Géographie",
  // Cities & Countries
  rome: "Géographie",
  istanbul: "Géographie",
  nice: "Géographie",
  vannes: "Géographie",
  "bruxelles de nos jours": "Géographie",
  "central park": "Géographie",
  "mont saint-michel": "Géographie",
  chambord: "Géographie",
  italie: "Géographie",
  belgique: "Géographie",
  canada: "Géographie",
  japon: "Géographie",
  "royaume-uni": "Géographie",
  bretagne: "Géographie",
  périgord: "Géographie",
  mouscron: "Géographie",
  auroville: "Géographie",

  // Sciences & Nature
  sciences: "Sciences & Nature",
  chimie: "Sciences & Nature",
  "magnésium": "Sciences & Nature",
  "réchauffement climatique": "Sciences & Nature",
  "volcans en activité": "Sciences & Nature",
  // Animals
  "animaux et habitats": "Sciences & Nature",
  "animaux en tout genre": "Sciences & Nature",
  "animaux en chiffres": "Sciences & Nature",
  "animaux célèbres": "Sciences & Nature",
  "nos amis les chats": "Sciences & Nature",
  "requins": "Sciences & Nature",
  chevaux: "Sciences & Nature",
  "oiseaux": "Sciences & Nature",
  fourmis: "Sciences & Nature",
  "abeilles du rucher": "Sciences & Nature",
  colombophilie: "Sciences & Nature",
  // Plants & Nature
  "faune et flore des champs": "Sciences & Nature",
  "forêts de france": "Sciences & Nature",
  "arbres fruitiers": "Sciences & Nature",
  cactus: "Sciences & Nature",
  pommes: "Sciences & Nature",
  "pomme de terre": "Sciences & Nature",
  "jardin japonais": "Sciences & Nature",
  // Health
  "santé et bien-être": "Sciences & Nature",
  "les cheveux": "Sciences & Nature",
  "les mamans": "Sciences & Nature",
  "autour de la neige": "Sciences & Nature",

  // Gastronomie
  gastronomie: "Gastronomie",
  "gastronomie étrangère": "Gastronomie",
  "fromages de france": "Gastronomie",
  "desserts et pâtisseries": "Gastronomie",
  "herbes et épices": "Gastronomie",
  chocolat: "Gastronomie",
  sucre: "Gastronomie",
  "déjeuner du matin": "Gastronomie",
  "garçon un café": "Gastronomie",
  "eaux minérales": "Gastronomie",
  "boissons sans alcool": "Gastronomie",
  "coca-cola company": "Gastronomie",

  // Littérature & BD
  littérature: "Littérature & BD",
  "auteurs classiques": "Littérature & BD",
  "citations littéraires": "Littérature & BD",
  "citations courtes": "Littérature & BD",
  "maxime chattam": "Littérature & BD",
  "harry potter": "Littérature & BD",
  tintin: "Littérature & BD",
  "super-héroïnes": "Littérature & BD",
  "héros marvel": "Littérature & BD",
  "pokemon": "Littérature & BD",

  // Jeux vidéo & Tech
  "jeux vidéo": "Jeux vidéo & Tech",
  "jeux et consoles nintendo": "Jeux vidéo & Tech",
  "playstation 2": "Jeux vidéo & Tech",
  "world of warcraft": "Jeux vidéo & Tech",
  informatique: "Jeux vidéo & Tech",
  "logiciels et applications web": "Jeux vidéo & Tech",
  "dans les méandres d'internet": "Jeux vidéo & Tech",
  "les réseaux sociaux": "Jeux vidéo & Tech",
  instagram: "Jeux vidéo & Tech",
  "microsoft": "Jeux vidéo & Tech",
  "linux": "Jeux vidéo & Tech",
  "openbsd": "Jeux vidéo & Tech",
  iphone: "Jeux vidéo & Tech",

  // People & Célébrités
  "actu people": "People & Célébrités",
  people: "People & Célébrités",
  "potins de stars": "People & Célébrités",
  "stars mondiales": "People & Célébrités",
  célébrités: "People & Célébrités",
  "prénoms célèbres": "People & Célébrités",
  "albert célèbres": "People & Célébrités",
  "beaux gosses": "People & Célébrités",
  "patrick sébastien": "People & Célébrités",
  "florence foresti": "People & Célébrités",
  "jean-marie bigard": "People & Célébrités",
  "meghan markle": "People & Célébrités",
  "donald trump": "People & Célébrités",
  "britney spears": "People & Célébrités",
  "virginie à l'écran": "People & Célébrités",
  "pamela anderson": "People & Célébrités",
  "covid-19": "People & Célébrités",
  "rétrospective 2021": "People & Célébrités",
  "c'était en 2019": "People & Célébrités",
  "la menace omicron": "People & Célébrités",

  // Art & Architecture
  art: "Art & Architecture",
  sculpture: "Art & Architecture",
  romantisme: "Art & Architecture",
  "musée du louvre": "Art & Architecture",
  "céramique et poterie": "Art & Architecture",

  // Fêtes & Traditions
  folklore: "Fêtes & Traditions",
  "folklore japonais": "Fêtes & Traditions",
  saints: "Fêtes & Traditions",
  halloween: "Fêtes & Traditions",
  "joyeux noël": "Fêtes & Traditions",
  "fête de saint-nicolas": "Fêtes & Traditions",

  // Mode & Lifestyle
  "victime de la mode": "Culture générale",
  maquillage: "Culture générale",
};

// ==========================================
// CONTENT FILTER
// ==========================================

// Quizzes to exclude entirely (by theme keywords, case-insensitive)
const EXCLUDED_THEME_KEYWORDS = [
  "bière", "bieres", "bières",
  "whisky", "whiskey",
  "cocktail",
  "tabac", "cigarette", "cigare",
  "porno", "playboy",
  "jenna jameson",
  "traci lords",
  "clara morgane",
  "adulte",
];

// Full theme names to exclude (exact match after lowercase + trim)
const EXCLUDED_THEMES_EXACT = new Set([
  "bières belges",
  "vins divins",
  "vins d'ailleurs",
  "gin",
  "playboy",
  "jenna jameson",
  "traci lords",
  "clara morgane",
  "pamela anderson",
]);

// Keywords in individual questions to filter out
const EXCLUDED_QUESTION_KEYWORDS = [
  "boisson alcoolisée", "alcoolique", "alcoolisé", "taux d'alcool",
  "bière", "bières", "houblon", "brasserie",
  "whisky", "whiskey", "bourbon",
  "vodka", "rhum", "tequila",
  "cocktail", "apéritif", "apéro",
  "vin rouge", "vin blanc", "vin rosé", "vignoble", "vendange", "cépage",
  "champagne", "mousseux", "prosecco",
  "tabac", "cigarette", "cigare", "fumer", "nicotine",
  "cannabis", "marijuana", "drogue",
  "pornographi", "érotique", "sexuel",
];

function isThemeExcluded(theme: string): boolean {
  const lower = theme.toLowerCase().trim();

  // Check exact matches
  if (EXCLUDED_THEMES_EXACT.has(lower)) return true;

  // Strip parenthetical subtitle for matching
  const base = lower.replace(/\s*\(.*\)$/, "").trim();
  if (EXCLUDED_THEMES_EXACT.has(base)) return true;

  // Check keyword matches
  for (const kw of EXCLUDED_THEME_KEYWORDS) {
    if (lower.includes(kw.trim())) return true;
  }

  return false;
}

function isQuestionExcluded(question: string, answer: string, anecdote: string): boolean {
  const combined = `${question} ${answer} ${anecdote}`.toLowerCase();
  for (const kw of EXCLUDED_QUESTION_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  return false;
}

// ==========================================
// THEME RESOLUTION
// ==========================================

function resolveTheme(originalTheme: string): string {
  const lower = originalTheme.toLowerCase().trim();
  // Strip parenthetical subtitle
  const base = lower.replace(/\s*\(.*\)$/, "").trim();

  // Try exact match first
  if (THEME_MAP[lower]) return THEME_MAP[lower];
  if (THEME_MAP[base]) return THEME_MAP[base];

  // Try prefix matching (for numbered themes like "Culture générale 5")
  for (const [key, value] of Object.entries(THEME_MAP)) {
    if (base.startsWith(key)) return value;
  }

  // Try keyword-based fallback
  if (base.includes("foot") || base.includes("tennis") || base.includes("sport") || base.includes("olympi"))
    return "Sport";
  if (base.includes("ciné") || base.includes("film") || base.includes("série") || base.includes("télé"))
    return "Cinéma & Séries";
  if (base.includes("musi") || base.includes("chant") || base.includes("rock") || base.includes("jazz"))
    return "Musique";
  if (base.includes("histoir") || base.includes("guerre") || base.includes("ancien"))
    return "Histoire";
  if (base.includes("géo") || base.includes("ville") || base.includes("pays") || base.includes("monument"))
    return "Géographie";
  if (base.includes("scienc") || base.includes("chimi") || base.includes("animal") || base.includes("nature"))
    return "Sciences & Nature";
  if (base.includes("gastro") || base.includes("fromage") || base.includes("cuisin") || base.includes("dessert"))
    return "Gastronomie";
  if (base.includes("littér") || base.includes("auteur") || base.includes("livre") || base.includes("roman"))
    return "Littérature & BD";
  if (base.includes("jeu") || base.includes("console") || base.includes("inform") || base.includes("web"))
    return "Jeux vidéo & Tech";
  if (base.includes("people") || base.includes("star") || base.includes("céléb") || base.includes("actu"))
    return "People & Célébrités";
  if (base.includes("art") || base.includes("sculpt") || base.includes("peintur") || base.includes("musée"))
    return "Art & Architecture";
  if (base.includes("noël") || base.includes("folklore") || base.includes("fête") || base.includes("tradition"))
    return "Fêtes & Traditions";

  // Default fallback
  return "Culture générale";
}

// ==========================================
// JSON PARSING
// ==========================================

interface OpenQuizzQuestion {
  id: number;
  question: string;
  propositions: string[];
  réponse: string;
  anecdote: string;
}

interface OpenQuizzFile {
  fournisseur: string;
  rédacteur: string;
  thème: string;
  difficulté: string;
  quizz: {
    débutant?: OpenQuizzQuestion[];
    confirmé?: OpenQuizzQuestion[];
    expert?: OpenQuizzQuestion[];
  };
}

function parseJsonFile(filepath: string): OpenQuizzFile | null {
  try {
    let content = fs.readFileSync(filepath, "utf-8");

    // Fix Windows line endings
    content = content.replace(/\r\n/g, "\n").replace(/\r/g, "");
    // Fix invalid JSON: difficulty value like 2 / 5
    content = content.replace(/"difficulté"\s*:\s*(\d+)\s*\/\s*(\d+)/g, '"difficulté": "$1/$2"');
    // Remove control characters (except newlines/tabs)
    content = content.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
    // Fix invalid backslash escapes (e.g. \')
    content = content.replace(/\\'/g, "'");

    return JSON.parse(content) as OpenQuizzFile;
  } catch {
    // Try with latin-1 encoding
    try {
      const buffer = fs.readFileSync(filepath);
      let content = buffer.toString("latin1");
      content = content.replace(/\r\n/g, "\n").replace(/\r/g, "");
      content = content.replace(/"difficulté"\s*:\s*(\d+)\s*\/\s*(\d+)/g, '"difficulté": "$1/$2"');
      content = content.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
      content = content.replace(/\\'/g, "'");
      return JSON.parse(content) as OpenQuizzFile;
    } catch {
      return null;
    }
  }
}

// ==========================================
// MAIN SEED FUNCTION
// ==========================================

function seed(dataDir: string): void {
  const dbPath = path.resolve(__dirname, "../data/questions.db");

  // Remove existing DB
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log("Removed existing database");
  }

  const db = new Database(dbPath);

  // Create table
  db.exec(`
    CREATE TABLE questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('qcm', 'open')),
      theme TEXT NOT NULL,
      original_theme TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard')),
      question TEXT NOT NULL,
      options TEXT, -- JSON array for QCM
      correct_answer TEXT NOT NULL,
      anecdote TEXT,
      source_file TEXT NOT NULL
    );

    CREATE INDEX idx_theme ON questions(theme);
    CREATE INDEX idx_difficulty ON questions(difficulty);
    CREATE INDEX idx_type ON questions(type);
    CREATE INDEX idx_theme_difficulty ON questions(theme, difficulty);
  `);

  const insert = db.prepare(`
    INSERT INTO questions (type, theme, original_theme, difficulty, question, options, correct_answer, anecdote, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const jsonFiles = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let totalInserted = 0;
  let totalSkippedTheme = 0;
  let totalSkippedQuestion = 0;
  let totalParseErrors = 0;
  const themeStats: Record<string, number> = {};

  const insertMany = db.transaction(
    (
      questions: {
        type: string;
        theme: string;
        originalTheme: string;
        difficulty: string;
        question: string;
        options: string | null;
        correctAnswer: string;
        anecdote: string | null;
        sourceFile: string;
      }[]
    ) => {
      for (const q of questions) {
        insert.run(
          q.type,
          q.theme,
          q.originalTheme,
          q.difficulty,
          q.question,
          q.options,
          q.correctAnswer,
          q.anecdote,
          q.sourceFile
        );
      }
    }
  );

  for (const file of jsonFiles) {
    const filepath = path.join(dataDir, file);
    const data = parseJsonFile(filepath);

    if (!data) {
      totalParseErrors++;
      continue;
    }

    const originalTheme = data.thème || "Unknown";

    // Check if entire theme is excluded
    if (isThemeExcluded(originalTheme)) {
      const questionCount = Object.values(data.quizz)
        .filter(Array.isArray)
        .reduce((sum, arr) => sum + arr.length, 0);
      totalSkippedTheme += questionCount;
      console.log(`  SKIP theme: ${originalTheme} (${file})`);
      continue;
    }

    const resolvedTheme = resolveTheme(originalTheme);

    const difficultyMap: Record<string, "easy" | "medium" | "hard"> = {
      débutant: "easy",
      confirmé: "medium",
      expert: "hard",
    };

    const batch: {
      type: string;
      theme: string;
      originalTheme: string;
      difficulty: string;
      question: string;
      options: string | null;
      correctAnswer: string;
      anecdote: string | null;
      sourceFile: string;
    }[] = [];

    for (const [level, questions] of Object.entries(data.quizz)) {
      if (!Array.isArray(questions)) continue;
      const difficulty = difficultyMap[level] || "medium";

      for (const q of questions) {
        if (!q.question || !q.propositions || !q.réponse) continue;

        // Filter individual questions
        if (isQuestionExcluded(q.question, q.réponse, q.anecdote || "")) {
          totalSkippedQuestion++;
          continue;
        }

        batch.push({
          type: "qcm",
          theme: resolvedTheme,
          originalTheme,
          difficulty,
          question: q.question.trim(),
          options: JSON.stringify(q.propositions),
          correctAnswer: q.réponse.trim(),
          anecdote: q.anecdote?.trim() || null,
          sourceFile: file,
        });
      }
    }

    if (batch.length > 0) {
      insertMany(batch);
      totalInserted += batch.length;
      themeStats[resolvedTheme] = (themeStats[resolvedTheme] || 0) + batch.length;
    }
  }

  db.close();

  // Print summary
  console.log("\n=== SEED COMPLETE ===\n");
  console.log(`Database: ${dbPath}`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Skipped (theme filter): ${totalSkippedTheme}`);
  console.log(`Skipped (question filter): ${totalSkippedQuestion}`);
  console.log(`Parse errors: ${totalParseErrors}`);
  console.log(`\nQuestions by theme:`);

  const sortedThemes = Object.entries(themeStats).sort((a, b) => b[1] - a[1]);
  for (const [theme, count] of sortedThemes) {
    console.log(`  ${theme.padEnd(25)} ${count}`);
  }

  console.log(`\nTotal themes: ${sortedThemes.length}`);
}

// ==========================================
// CLI
// ==========================================

const dataDir = process.argv[2] || "/tmp/openquizzdb/data";

if (!fs.existsSync(dataDir)) {
  console.error(`Data directory not found: ${dataDir}`);
  console.error(
    "Clone the repo first: git clone https://github.com/Zeuh/OpenQuizzDB.git /tmp/openquizzdb"
  );
  process.exit(1);
}

console.log(`Seeding from: ${dataDir}\n`);
seed(dataDir);
