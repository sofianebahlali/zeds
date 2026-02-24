import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import type { QCMQuestion, OpenQuestion, Question } from "../src/types";

// ==========================================
// THEME CONSTANTS
// ==========================================

export const QUESTION_THEMES = [
  "Culture générale",
  "Cinéma & Séries",
  "Musique",
  "Sport",
  "Histoire",
  "Géographie",
  "Sciences & Nature",
  "Gastronomie",
  "Littérature & BD",
  "Jeux vidéo & Tech",
  "People & Célébrités",
  "Art & Architecture",
  "Fêtes & Traditions",
] as const;

export type QuestionTheme = (typeof QUESTION_THEMES)[number];

// ==========================================
// DATABASE SETUP
// ==========================================

const DB_PATH = path.resolve(__dirname, "../data/questions.db");

let db: Database.Database | null = null;

function getDb(): Database.Database | null {
  if (db) return db;

  if (!fs.existsSync(DB_PATH)) {
    console.warn(`[question-db] Database not found at ${DB_PATH}`);
    return null;
  }

  try {
    db = new Database(DB_PATH, { readonly: true });
    console.log(`[question-db] Connected to ${DB_PATH}`);
    return db;
  } catch (err) {
    console.warn(`[question-db] Failed to open database:`, err);
    return null;
  }
}

// ==========================================
// QUERY INTERFACES
// ==========================================

interface DbRow {
  id: number;
  type: "qcm" | "open";
  theme: string;
  original_theme: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string; // JSON array
  correct_answer: string;
  anecdote: string | null;
  source_file: string;
}

export interface QueryOptions {
  count: number;
  theme?: string;
  difficulty?: "easy" | "medium" | "hard";
  excludeIds?: Set<number>;
}

// ==========================================
// QUERY FUNCTIONS
// ==========================================

/**
 * Get random questions from the database, with optional filtering
 */
export function getQuestions(options: QueryOptions): Question[] {
  const database = getDb();
  if (!database) return [];

  const { count, theme, difficulty, excludeIds } = options;

  let sql = "SELECT * FROM questions WHERE 1=1";
  const params: (string | number)[] = [];

  if (theme) {
    sql += " AND theme = ?";
    params.push(theme);
  }

  if (difficulty) {
    sql += " AND difficulty = ?";
    params.push(difficulty);
  }

  if (excludeIds && excludeIds.size > 0) {
    // SQLite doesn't support array params, use NOT IN with placeholders
    const placeholders = Array.from(excludeIds).map(() => "?").join(",");
    sql += ` AND id NOT IN (${placeholders})`;
    params.push(...Array.from(excludeIds));
  }

  sql += " ORDER BY RANDOM() LIMIT ?";
  params.push(count);

  try {
    const rows = database.prepare(sql).all(...params) as DbRow[];
    return rows.map(rowToQuestion);
  } catch (err) {
    console.error("[question-db] Query error:", err);
    return [];
  }
}

/**
 * Get available themes with question counts
 */
export function getThemeCounts(): Record<string, number> {
  const database = getDb();
  if (!database) return {};

  try {
    const rows = database
      .prepare("SELECT theme, COUNT(*) as count FROM questions GROUP BY theme ORDER BY count DESC")
      .all() as { theme: string; count: number }[];

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.theme] = row.count;
    }
    return result;
  } catch (err) {
    console.error("[question-db] Theme count error:", err);
    return {};
  }
}

/**
 * Get total question count
 */
export function getTotalCount(): number {
  const database = getDb();
  if (!database) return 0;

  try {
    const row = database.prepare("SELECT COUNT(*) as total FROM questions").get() as { total: number };
    return row.total;
  } catch {
    return 0;
  }
}

// ==========================================
// ROW CONVERSION
// ==========================================

function rowToQuestion(row: DbRow): Question {
  if (row.type === "qcm") {
    const options: string[] = JSON.parse(row.options);
    const correctIndex = options.indexOf(row.correct_answer);

    return {
      id: `db_${row.id}`,
      type: "qcm",
      question: row.question,
      options,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      timeLimit: row.difficulty === "hard" ? 15 : 20,
      points: row.difficulty === "hard" ? 150 : 100,
    } as QCMQuestion;
  }

  // Open question: correct_answer is the main answer
  return {
    id: `db_${row.id}`,
    type: "open",
    question: row.question,
    answers: [row.correct_answer],
    caseSensitive: false,
    timeLimit: 20,
    points: 150,
  } as OpenQuestion;
}

/**
 * Close the database connection (for clean shutdown)
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
