import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  FootballConnectionAnswer,
  FootballConnectionDifficulty,
  FootballConnectionFormat,
  FootballConnectionQuestion,
  MysteryCareerClub,
  MysteryCareerQuestion,
  MissingClubQuestion,
} from "../src/types";

const DB_PATH = path.resolve(__dirname, "../data/football.db");

let db: Database.Database | null = null;
let mysteryCareerCache: MysteryCareerQuestion[] | null = null;
let missingClubCache: MissingClubQuestion[] | null = null;

interface ConnectionRow {
  id: string;
  format: FootballConnectionFormat;
  left_team_id: number | null;
  right_team_id: number | null;
  left_label: string;
  right_label: string;
  left_kind: "club" | "country" | "initial";
  right_kind: "club" | "country" | "initial";
  difficulty: "easy" | "medium" | "hard";
  time_limit: number;
  points: number;
  answer_count: number;
}

interface AnswerRow {
  question_id: string;
  player_id: number;
  display_name: string;
  left_detail: string | null;
  right_detail: string | null;
  fame_score: number;
}

interface MysteryCareerPlayerRow {
  player_id: number;
  display_name: string;
  sporting_country: string | null;
  fame_score: number;
  difficulty: "easy" | "medium" | "hard";
}

interface MysteryCareerClubRow {
  player_id: number;
  team_id: number;
  canonical_name: string;
  first_date: string | null;
  last_date: string | null;
  appearances: number | null;
  goals: number | null;
  fame_score: number;
}

export interface FootballDatabaseSummary {
  players: number;
  clubs: number;
  nationalTeams: number;
  careerSpells: number;
  granularStatRows: number;
  statSnapshots: number;
  connections: number;
}

export interface FootballPlayerProfile {
  id: number;
  displayName: string;
  birthDate: string | null;
  sportingCountry: string | null;
  clubs: {
    id: number;
    name: string;
    from: string | null;
    to: string | null;
    appearances: number | null;
    goals: number | null;
    calculationMethod: string | null;
  }[];
}

function getDb(): Database.Database | null {
  if (db) return db;
  if (!fs.existsSync(DB_PATH)) {
    console.warn(`[football-db] Database not found at ${DB_PATH}`);
    return null;
  }
  try {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("foreign_keys = ON");
    return db;
  } catch (error) {
    console.warn("[football-db] Could not open football database:", error);
    return null;
  }
}

/**
 * Load the complete precomputed pool. The engine applies room history,
 * difficulty and scheduling constraints before dealing a segment.
 */
export function getFootballConnectionPool(): FootballConnectionQuestion[] {
  const database = getDb();
  if (!database) return [];

  const rows = database.prepare(`
    SELECT id, format, left_team_id, right_team_id, left_label, right_label,
           left_kind, right_kind, difficulty, time_limit, points, answer_count
    FROM football_connection_questions
    ORDER BY id
  `).all() as ConnectionRow[];
  return hydrateConnectionRows(database, rows);
}

/**
 * Deal from a bounded, database-randomized window instead of materializing the
 * complete six-figure question bank for every room.
 */
export function getFootballConnectionCandidates(options: {
  formats: readonly FootballConnectionFormat[];
  preferredDifficulty: FootballConnectionDifficulty;
  limit?: number;
}): FootballConnectionQuestion[] {
  const database = getDb();
  if (!database) return [];
  const formats = options.formats.length
    ? options.formats
    : ["club_club", "club_country", "initials"] as const;
  const placeholders = formats.map(() => "?").join(", ");
  const difficultyOrder = options.preferredDifficulty === "mixed"
    ? ""
    : "CASE WHEN difficulty = ? THEN 0 ELSE 1 END,";
  const accessibilityThreshold =
    options.preferredDifficulty === "easy"
      ? 98
      : options.preferredDifficulty === "medium" || options.preferredDifficulty === "mixed"
      ? 94
      : null;
  const accessibilityFilter = accessibilityThreshold === null
    ? ""
    : `AND EXISTS (
        SELECT 1
        FROM football_connection_answers accessible_answer
        JOIN players accessible_player ON accessible_player.id = accessible_answer.player_id
        WHERE accessible_answer.question_id = football_connection_questions.id
          AND accessible_player.fame_score >= ?
      )`;
  const parameters: (string | number)[] = [...formats];
  if (accessibilityThreshold !== null) parameters.push(accessibilityThreshold);
  if (options.preferredDifficulty !== "mixed") {
    parameters.push(options.preferredDifficulty);
  }
  parameters.push(Math.max(100, Math.min(options.limit ?? 6_000, 10_000)));

  const rows = database.prepare(`
    SELECT id, format, left_team_id, right_team_id, left_label, right_label,
           left_kind, right_kind, difficulty, time_limit, points, answer_count
    FROM football_connection_questions
    WHERE format IN (${placeholders})
      ${accessibilityFilter}
    ORDER BY ${difficultyOrder} RANDOM()
    LIMIT ?
  `).all(...parameters) as ConnectionRow[];
  return hydrateConnectionRows(database, rows);
}

export function findFootballConnections(
  leftLabel: string,
  rightLabel: string
): FootballConnectionQuestion[] {
  const database = getDb();
  if (!database) return [];
  const rows = database.prepare(`
    SELECT id, format, left_team_id, right_team_id, left_label, right_label,
           left_kind, right_kind, difficulty, time_limit, points, answer_count
    FROM football_connection_questions
    WHERE (left_label = ? AND right_label = ?)
       OR (left_label = ? AND right_label = ?)
    ORDER BY difficulty, id
  `).all(leftLabel, rightLabel, rightLabel, leftLabel) as ConnectionRow[];
  return hydrateConnectionRows(database, rows);
}

/**
 * Builds mystery careers directly from the reusable player/stat graph.
 * Only clubs with a recorded senior appearance are included: a transfer entry
 * without a match must never become a misleading clue.
 */
export function getMysteryCareerCandidates(options: {
  preferredDifficulty: FootballConnectionDifficulty;
  limit: number;
}): MysteryCareerQuestion[] {
  const database = getDb();
  if (!database) return [];

  const safeLimit = Math.max(1, Math.min(options.limit, 2_000));
  const preferred = options.preferredDifficulty;
  if (mysteryCareerCache) {
    return sampleMysteryCareers(mysteryCareerCache, preferred, safeLimit);
  }

  const players = database.prepare(`
    WITH career_clubs AS (
      SELECT
        ps.player_id,
        ps.team_id,
        MAX(t.fame_score) AS club_fame,
        SUM(COALESCE(ps.appearances, 0)) AS appearances
      FROM player_season_stats ps
      JOIN teams t ON t.id = ps.team_id AND t.team_type = 'club'
        AND LOWER(t.canonical_name) NOT LIKE '% primavera%'
        AND LOWER(t.canonical_name) NOT LIKE '% academy%'
        AND LOWER(t.canonical_name) NOT LIKE '% youth%'
        AND LOWER(t.canonical_name) NOT LIKE '% reserves%'
        AND LOWER(t.canonical_name) NOT LIKE '% u19%'
        AND LOWER(t.canonical_name) NOT LIKE '% u21%'
        AND LOWER(t.canonical_name) NOT LIKE '% u23%'
        AND LOWER(t.canonical_name) NOT LIKE '% ii'
        AND LOWER(t.canonical_name) NOT LIKE '% b'
      GROUP BY ps.player_id, ps.team_id
      HAVING SUM(COALESCE(ps.appearances, 0)) > 0
    ),
    candidates AS (
      SELECT
        p.id AS player_id,
        p.display_name,
        country.name AS sporting_country,
        p.fame_score,
        COUNT(*) AS club_count,
        SUM(CASE WHEN career_clubs.club_fame >= 65 THEN 1 ELSE 0 END) AS notable_clubs,
        CASE
          WHEN p.fame_score >= 98 THEN 'easy'
          WHEN p.fame_score >= 94 THEN 'medium'
          ELSE 'hard'
        END AS difficulty
      FROM players p
      JOIN career_clubs ON career_clubs.player_id = p.id
      LEFT JOIN countries country ON country.id = p.sporting_country_id
      WHERE p.game_eligible = 1
        AND p.fame_score >= 82
        AND TRIM(p.display_name) <> ''
      GROUP BY p.id
      HAVING COUNT(*) BETWEEN 3 AND 12
         AND MAX(career_clubs.appearances) >= 10
         AND SUM(CASE WHEN career_clubs.club_fame >= 60 THEN 1 ELSE 0 END) >= 2
    )
    SELECT player_id, display_name, sporting_country, fame_score, difficulty
    FROM candidates
    WHERE difficulty IN ('easy', 'medium', 'hard')
    ORDER BY RANDOM()
    LIMIT ?
  `).all(2_000) as MysteryCareerPlayerRow[];
  if (players.length === 0) return [];

  const ids = players.map((player) => player.player_id);
  const placeholders = ids.map(() => "?").join(", ");
  const clubRows = database.prepare(`
    SELECT
      ps.player_id,
      ps.team_id,
      t.canonical_name,
      MIN(se.start_date) AS first_date,
      MAX(se.end_date) AS last_date,
      SUM(COALESCE(ps.appearances, 0)) AS appearances,
      SUM(COALESCE(ps.goals, 0)) AS goals,
      MAX(t.fame_score) AS fame_score
    FROM player_season_stats ps
    JOIN teams t ON t.id = ps.team_id AND t.team_type = 'club'
      AND LOWER(t.canonical_name) NOT LIKE '% primavera%'
      AND LOWER(t.canonical_name) NOT LIKE '% academy%'
      AND LOWER(t.canonical_name) NOT LIKE '% youth%'
      AND LOWER(t.canonical_name) NOT LIKE '% reserves%'
      AND LOWER(t.canonical_name) NOT LIKE '% u19%'
      AND LOWER(t.canonical_name) NOT LIKE '% u21%'
      AND LOWER(t.canonical_name) NOT LIKE '% u23%'
      AND LOWER(t.canonical_name) NOT LIKE '% ii'
      AND LOWER(t.canonical_name) NOT LIKE '% b'
    JOIN seasons se ON se.id = ps.season_id
    WHERE ps.player_id IN (${placeholders})
      AND TRIM(t.canonical_name) <> ''
    GROUP BY ps.player_id, ps.team_id
    HAVING SUM(COALESCE(ps.appearances, 0)) > 0
    ORDER BY ps.player_id, MIN(se.start_date), t.canonical_name
  `).all(...ids) as MysteryCareerClubRow[];
  const aliasRows = database.prepare(`
    SELECT player_id, alias
    FROM player_aliases
    WHERE player_id IN (${placeholders})
    ORDER BY player_id, alias
  `).all(...ids) as { player_id: number; alias: string }[];

  const aliasesByPlayer = new Map<number, string[]>();
  for (const row of aliasRows) {
    const aliases = aliasesByPlayer.get(row.player_id) ?? [];
    aliases.push(row.alias);
    aliasesByPlayer.set(row.player_id, aliases);
  }

  const clubsByPlayer = new Map<number, MysteryCareerClub[]>();
  for (const row of clubRows) {
    const clubs = clubsByPlayer.get(row.player_id) ?? [];
    const key = normalizeClubIdentity(row.canonical_name);
    const existing = clubs.find((club) => normalizeClubIdentity(club.name) === key);
    if (existing) {
      existing.fromYear = earliestDate(existing.fromYear, yearOf(row.first_date));
      existing.toYear = latestDate(existing.toYear, yearOf(row.last_date));
      existing.appearances = (existing.appearances ?? 0) + (row.appearances ?? 0);
      existing.goals = (existing.goals ?? 0) + (row.goals ?? 0);
      if (row.canonical_name.length < existing.name.length) existing.name = row.canonical_name;
    } else {
      clubs.push({
        teamId: row.team_id,
        name: row.canonical_name,
        fromYear: yearOf(row.first_date),
        toYear: yearOf(row.last_date),
        appearances: row.appearances,
        goals: row.goals,
        order: clubs.length,
        fameScore: row.fame_score,
      });
    }
    clubsByPlayer.set(row.player_id, clubs);
  }

  mysteryCareerCache = players.flatMap((player) => {
    const clubs = (clubsByPlayer.get(player.player_id) ?? [])
      .sort((a, b) => (a.fromYear ?? "9999").localeCompare(b.fromYear ?? "9999"))
      .map((club, order) => ({ ...club, order }));
    if (clubs.length < 3 || clubs.length > 12) return [];
    const timeLimit = Math.min(35, Math.max(20, (clubs.length - 1) * 3 + 6));
    return [{
      id: `mc-${player.player_id}`,
      type: "mysterycareer" as const,
      playerId: player.player_id,
      playerName: player.display_name,
      aliases: Array.from(new Set([
        player.display_name,
        ...(aliasesByPlayer.get(player.player_id) ?? []),
      ])),
      sportingCountry: player.sporting_country,
      clubs,
      totalClubs: clubs.length,
      revealInterval: 3,
      difficulty: player.difficulty,
      timeLimit,
      points: 100,
    }];
  });
  return sampleMysteryCareers(mysteryCareerCache, preferred, safeLimit);
}

function sampleMysteryCareers(
  pool: MysteryCareerQuestion[],
  preferred: FootballConnectionDifficulty,
  limit: number
): MysteryCareerQuestion[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  if (preferred === "mixed") {
    return shuffled
      .sort((left, right) => difficultyRank(left.difficulty) - difficultyRank(right.difficulty))
      .slice(0, limit);
  }
  return shuffled
    .sort((left, right) =>
      Number(right.difficulty === preferred) - Number(left.difficulty === preferred)
    )
    .slice(0, limit);
}

/**
 * Produces one card per plausible interior gap in a career. The first and last
 * clubs stay visible so the player always gets chronological context on both
 * sides of the missing stop.
 */
export function getMissingClubCandidates(options: {
  preferredDifficulty: FootballConnectionDifficulty;
  limit: number;
}): MissingClubQuestion[] {
  const database = getDb();
  if (!database) return [];
  const safeLimit = Math.max(1, Math.min(options.limit, 2_000));

  if (!missingClubCache) {
    const careers = getMysteryCareerCandidates({
      preferredDifficulty: "mixed",
      limit: 2_000,
    }).filter((career) => career.clubs.length >= 4);
    const teamIds = Array.from(new Set(
      careers.flatMap((career) => career.clubs.map((club) => club.teamId))
    ));
    if (teamIds.length === 0) return [];
    const placeholders = teamIds.map(() => "?").join(", ");
    const teamRows = database.prepare(`
      SELECT id, canonical_name, country_id, fame_score
      FROM teams
      WHERE id IN (${placeholders})
    `).all(...teamIds) as {
      id: number;
      canonical_name: string;
      country_id: number | null;
      fame_score: number;
    }[];
    const famousTeams = database.prepare(`
      SELECT id, canonical_name, country_id, fame_score
      FROM teams
      WHERE team_type = 'club'
        AND fame_score >= 65
        AND TRIM(canonical_name) <> ''
      ORDER BY fame_score DESC, canonical_name
    `).all() as {
      id: number;
      canonical_name: string;
      country_id: number | null;
      fame_score: number;
    }[];
    const playerIds = careers.map((career) => career.playerId);
    const playerPlaceholders = playerIds.map(() => "?").join(", ");
    const playerRows = database.prepare(`
      SELECT id, fame_score
      FROM players
      WHERE id IN (${playerPlaceholders})
    `).all(...playerIds) as { id: number; fame_score: number }[];
    const aliasRows = database.prepare(`
      SELECT team_id, alias
      FROM team_aliases
      WHERE team_id IN (${placeholders})
      ORDER BY team_id, alias
    `).all(...teamIds) as { team_id: number; alias: string }[];
    const fameByTeam = new Map(teamRows.map((row) => [row.id, row.fame_score]));
    const teamById = new Map(teamRows.map((row) => [row.id, row]));
    const fameByPlayer = new Map(playerRows.map((row) => [row.id, row.fame_score]));
    const aliasesByTeam = new Map<number, string[]>();
    for (const row of aliasRows) {
      const aliases = aliasesByTeam.get(row.team_id) ?? [];
      aliases.push(row.alias);
      aliasesByTeam.set(row.team_id, aliases);
    }

    missingClubCache = careers.flatMap((career) =>
      career.clubs.slice(1, -1).flatMap((club, offset) => {
        if ((club.appearances ?? 0) < 3) return [];
        const missingIndex = offset + 1;
        const clubFame = fameByTeam.get(club.teamId) ?? 0;
        const playerFame = fameByPlayer.get(career.playerId) ?? 0;
        const difficulty: "easy" | "medium" | "hard" =
          clubFame >= 75 && playerFame >= 98
            ? "easy"
            : clubFame >= 65 && playerFame >= 94
            ? "medium"
            : "hard";
        if (difficulty === "hard") return [];
        const hiddenTeam = teamById.get(club.teamId);
        const distractors = famousTeams
          .filter((team) =>
            team.id !== club.teamId
            && !career.clubs.some((careerClub) => careerClub.teamId === team.id)
          )
          .sort((left, right) => {
            const countryDifference =
              Number(right.country_id === hiddenTeam?.country_id)
              - Number(left.country_id === hiddenTeam?.country_id);
            if (countryDifference !== 0) return countryDifference;
            return Math.abs(left.fame_score - clubFame) - Math.abs(right.fame_score - clubFame);
          });
        const optionSeed = hashString(`${career.playerId}-${club.teamId}-${missingIndex}`);
        const options = seededShuffle(
          [
            club.name,
            ...seededShuffle(distractors.slice(0, 10), optionSeed)
              .slice(0, 3)
              .map((team) => team.canonical_name),
          ],
          optionSeed + 17
        );
        if (options.length < 4) return [];
        return [{
          id: `missing-${career.playerId}-${club.teamId}-${missingIndex}`,
          type: "missingclub" as const,
          playerId: career.playerId,
          playerName: career.playerName,
          sportingCountry: career.sportingCountry,
          clubs: career.clubs,
          missingIndex,
          missingClubName: club.name,
          acceptedAnswers: Array.from(new Set([
            club.name,
            ...(aliasesByTeam.get(club.teamId) ?? []),
          ])),
          options,
          difficulty,
          timeLimit: 20,
          points: 100,
        }];
      })
    );
  }

  const shuffled = [...missingClubCache].sort(() => Math.random() - 0.5);
  if (options.preferredDifficulty === "mixed") {
    return shuffled
      .sort((left, right) => difficultyRank(left.difficulty) - difficultyRank(right.difficulty))
      .slice(0, safeLimit);
  }
  return shuffled
    .sort((left, right) =>
      Number(right.difficulty === options.preferredDifficulty)
      - Number(left.difficulty === options.preferredDifficulty)
    )
    .slice(0, safeLimit);
}

function yearOf(value: string | null): string | null {
  const match = value?.match(/^\d{4}/);
  return match?.[0] ?? null;
}

function earliestDate(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left < right ? left : right;
}

function latestDate(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

function normalizeClubIdentity(value: string): string {
  return normalizeForLookup(value)
    .replace(/\b(?:fc|cf|afc|ac|football club|calcio)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function difficultyRank(value: "easy" | "medium" | "hard"): number {
  return value === "easy" ? 0 : value === "medium" ? 1 : 2;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index--) {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    const picked = Math.abs(state) % (index + 1);
    [result[index], result[picked]] = [result[picked], result[index]];
  }
  return result;
}

function hydrateConnectionRows(
  database: Database.Database,
  rows: ConnectionRow[]
): FootballConnectionQuestion[] {
  if (rows.length === 0) return [];

  const questionPlaceholders = rows.map(() => "?").join(", ");
  const answerRows = database.prepare(`
    SELECT a.question_id, a.player_id, p.display_name, a.left_detail, a.right_detail,
           p.fame_score
    FROM football_connection_answers a
    JOIN players p ON p.id = a.player_id
    WHERE a.question_id IN (${questionPlaceholders})
    ORDER BY a.question_id, p.fame_score DESC, p.display_name
  `).all(...rows.map((row) => row.id)) as AnswerRow[];
  const playerIds = Array.from(new Set(answerRows.map((row) => row.player_id)));
  const playerPlaceholders = playerIds.map(() => "?").join(", ");
  const aliasRows = playerIds.length === 0 ? [] : database.prepare(`
    SELECT player_id, alias
    FROM player_aliases
    WHERE player_id IN (${playerPlaceholders})
    ORDER BY player_id, alias
  `).all(...playerIds) as { player_id: number; alias: string }[];

  const aliasesByPlayer = new Map<number, string[]>();
  for (const alias of aliasRows) {
    const aliases = aliasesByPlayer.get(alias.player_id) ?? [];
    aliases.push(alias.alias);
    aliasesByPlayer.set(alias.player_id, aliases);
  }

  const answersByQuestion = new Map<string, FootballConnectionAnswer[]>();
  for (const row of answerRows) {
    const answers = answersByQuestion.get(row.question_id) ?? [];
    answers.push({
      playerId: row.player_id,
      playerName: row.display_name,
      aliases: Array.from(new Set([
        row.display_name,
        ...(aliasesByPlayer.get(row.player_id) ?? []),
      ])),
      leftDetail: row.left_detail ?? undefined,
      rightDetail: row.right_detail ?? undefined,
      fameScore: row.fame_score,
    });
    answersByQuestion.set(row.question_id, answers);
  }

  return rows.map((row) => {
    const answers = answersByQuestion.get(row.id) ?? [];
    return {
      id: row.id,
      type: "footballconnection",
      format: row.format,
      left: {
        id: row.left_team_id,
        label: row.left_label,
        kind: row.left_kind,
      },
      right: {
        id: row.right_team_id,
        label: row.right_label,
        kind: row.right_kind,
      },
      difficulty: row.difficulty,
      answerCount: row.answer_count,
      answerHint: initialsOf(answers[0]?.playerName ?? ""),
      answers,
      timeLimit: Math.max(row.time_limit, row.difficulty === "easy" ? 22 : 18),
      points: row.points,
    };
  });
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toLocaleUpperCase("fr")}.`)
    .join(" ");
}

export function getFootballDatabaseSummary(): FootballDatabaseSummary {
  const database = getDb();
  if (!database) {
    return {
      players: 0,
      clubs: 0,
      nationalTeams: 0,
      careerSpells: 0,
      granularStatRows: 0,
      statSnapshots: 0,
      connections: 0,
    };
  }
  return database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM players) AS players,
      (SELECT COUNT(*) FROM teams WHERE team_type = 'club') AS clubs,
      (SELECT COUNT(*) FROM teams WHERE team_type = 'national') AS nationalTeams,
      (SELECT COUNT(*) FROM player_team_spells) AS careerSpells,
      (SELECT COUNT(*) FROM player_season_stats) AS granularStatRows,
      (SELECT COUNT(*) FROM player_team_stat_snapshots) AS statSnapshots,
      (SELECT COUNT(*) FROM football_connection_questions) AS connections
  `).get() as FootballDatabaseSummary;
}

export function findFootballPlayer(name: string): FootballPlayerProfile | null {
  const database = getDb();
  if (!database) return null;
  const normalized = normalizeForLookup(name);
  const player = database.prepare(`
    SELECT DISTINCT p.id, p.display_name, p.birth_date, c.name AS sporting_country
    FROM players p
    LEFT JOIN countries c ON c.id = p.sporting_country_id
    LEFT JOIN player_aliases a ON a.player_id = p.id
    WHERE p.normalized_name = ? OR a.normalized_alias = ?
    ORDER BY p.fame_score DESC
    LIMIT 1
  `).get(normalized, normalized) as {
    id: number;
    display_name: string;
    birth_date: string | null;
    sporting_country: string | null;
  } | undefined;
  if (!player) return null;

  const clubs = database.prepare(`
    SELECT
      t.id,
      t.canonical_name,
      MIN(s.start_date) AS start_date,
      MAX(s.end_date) AS end_date,
      totals.appearances,
      totals.goals,
      totals.calculation_method
    FROM player_team_spells s
    JOIN teams t ON t.id = s.team_id AND t.team_type = 'club'
    LEFT JOIN v_player_club_totals totals
      ON totals.player_id = s.player_id AND totals.team_id = s.team_id
    WHERE s.player_id = ?
    GROUP BY t.id
    ORDER BY MIN(s.start_date), t.canonical_name
  `).all(player.id) as {
    id: number;
    canonical_name: string;
    start_date: string | null;
    end_date: string | null;
    appearances: number | null;
    goals: number | null;
    calculation_method: string | null;
  }[];

  return {
    id: player.id,
    displayName: player.display_name,
    birthDate: player.birth_date,
    sportingCountry: player.sporting_country,
    clubs: clubs.map((club) => ({
      id: club.id,
      name: club.canonical_name,
      from: club.start_date,
      to: club.end_date,
      appearances: club.appearances,
      goals: club.goals,
      calculationMethod: club.calculation_method,
    })),
  };
}

function normalizeForLookup(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

export function closeFootballDb(): void {
  if (db) {
    db.close();
    db = null;
  }
  mysteryCareerCache = null;
  missingClubCache = null;
}
