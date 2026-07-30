import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { rebuildFootballConnections, normalizeFootballText } from "./lib/football-connections";

interface ParcoursSeed {
  playerName: string;
  acceptedAnswers: string[];
  difficulty: "easy" | "medium" | "hard";
  nationality: string;
  clubs: { name: string; years: string }[];
}

interface CorePlayer {
  externalIds?: Record<string, string>;
  displayName: string;
  givenName: string;
  familyName: string;
  birthDate: string;
  country: { code: string; name: string; flag: string };
  aliases: string[];
  fameScore: number;
  clubs: {
    name: string;
    countryCode?: string;
    from: string;
    to: string | null;
    appearances?: number;
    goals?: number;
  }[];
  clubTotals?: {
    name: string;
    appearances: number;
    goals: number;
    scope: "domestic_league" | "all_official";
  }[];
}

const ROOT = path.resolve(__dirname, "..");
const FINAL_DB = path.join(ROOT, "data/football.db");
const TEMP_DB = path.join(ROOT, "data/football.db.building");
const SCHEMA = path.join(ROOT, "data/football/schema.sql");
const PARCOURS = path.join(ROOT, "data/questions/parcours.json");
const CORE = path.join(ROOT, "data/football/core-players.json");
const NOW = new Date().toISOString();

const COUNTRY_BY_NAME: Record<string, { code: string; name: string; flag: string }> = {
  "France": { code: "FRA", name: "France", flag: "🇫🇷" },
  "Espagne": { code: "ESP", name: "Espagne", flag: "🇪🇸" },
  "Italie": { code: "ITA", name: "Italie", flag: "🇮🇹" },
  "Allemagne": { code: "DEU", name: "Allemagne", flag: "🇩🇪" },
  "Angleterre": { code: "ENG", name: "Angleterre", flag: "🏴" },
  "Portugal": { code: "PRT", name: "Portugal", flag: "🇵🇹" },
  "Pays-Bas": { code: "NLD", name: "Pays-Bas", flag: "🇳🇱" },
  "Belgique": { code: "BEL", name: "Belgique", flag: "🇧🇪" },
  "Sénégal": { code: "SEN", name: "Sénégal", flag: "🇸🇳" },
  "Bulgarie": { code: "BGR", name: "Bulgarie", flag: "🇧🇬" },
  "Suisse": { code: "CHE", name: "Suisse", flag: "🇨🇭" },
  "Colombie": { code: "COL", name: "Colombie", flag: "🇨🇴" },
  "Argentine": { code: "ARG", name: "Argentine", flag: "🇦🇷" },
  "Uruguay": { code: "URY", name: "Uruguay", flag: "🇺🇾" },
  "Côte d'Ivoire": { code: "CIV", name: "Côte d’Ivoire", flag: "🇨🇮" },
  "Brésil": { code: "BRA", name: "Brésil", flag: "🇧🇷" },
  "Mali": { code: "MLI", name: "Mali", flag: "🇲🇱" },
  "États-Unis": { code: "USA", name: "États-Unis", flag: "🇺🇸" },
  "Algérie": { code: "DZA", name: "Algérie", flag: "🇩🇿" },
  "Paraguay": { code: "PRY", name: "Paraguay", flag: "🇵🇾" },
  "Arabie saoudite": { code: "SAU", name: "Arabie saoudite", flag: "🇸🇦" },
};

const COUNTRY_BY_CODE = new Map(
  Object.values(COUNTRY_BY_NAME).map((country) => [country.code, country])
);

const TEAM_CANONICAL: Record<string, string> = {
  "fc barcelona": "FC Barcelone",
  "fc barcelone": "FC Barcelone",
  "barcelona": "FC Barcelone",
  "paris saint germain": "Paris Saint-Germain",
  "psg": "Paris Saint-Germain",
  "fc bayern munchen": "Bayern Munich",
  "bayern munchen": "Bayern Munich",
  "bayern munich": "Bayern Munich",
  "real madrid club de futbol": "Real Madrid",
  "internazionale": "Inter Milan",
  "inter": "Inter Milan",
  "olympique de marseille": "Olympique de Marseille",
  "marseille": "Olympique de Marseille",
  "olympique lyonnais": "Olympique Lyonnais",
  "lyon": "Olympique Lyonnais",
};

const BIG_CLUBS = new Set([
  "Real Madrid", "FC Barcelone", "Manchester United", "Manchester City",
  "Liverpool", "Arsenal", "Chelsea", "Tottenham Hotspur", "Bayern Munich",
  "Borussia Dortmund", "Paris Saint-Germain", "Olympique de Marseille",
  "Olympique Lyonnais", "Juventus", "AC Milan", "Inter Milan", "AS Roma",
  "Napoli", "Atlético Madrid", "Séville FC", "Valencia CF", "Ajax",
  "PSV Eindhoven", "FC Porto", "Benfica", "Sporting CP",
]);

const KNOWN_CLUBS = new Set([
  "Newcastle United", "West Ham United", "Aston Villa", "Everton",
  "Leicester City", "Crystal Palace", "Lille OSC", "AS Monaco",
  "Girondins de Bordeaux", "Stade Rennais", "AS Saint-Étienne",
  "Fenerbahçe", "Galatasaray", "Olympiacos", "Lazio", "Fiorentina",
  "Villarreal", "Real Sociedad", "Schalke 04", "Werder Brême",
  "Bayer Leverkusen", "Wolfsburg", "Chicago Fire", "Inter Miami", "Al-Nassr",
]);

// These players have the nationality present in the legacy Parcours file but
// no senior cap for that country. They remain in the career graph but cannot
// generate a club↔selection question.
const NO_CONFIRMED_SENIOR_SELECTION = new Set([
  normalizeFootballText("Moussa Dembélé"),
  normalizeFootballText("Mathieu Bodmer"),
  normalizeFootballText("Maxi López"),
]);

function canonicalTeamName(name: string): string {
  const normalized = normalizeFootballText(name);
  return TEAM_CANONICAL[normalized] ?? name.trim();
}

function parseYears(years: string): [string | null, string | null] {
  const matches = years.match(/\d{4}/g) ?? [];
  return [matches[0] ?? null, matches[1] ?? matches[0] ?? null];
}

function splitPlayerName(name: string): [string | null, string | null] {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return [parts[0] ?? null, null];
  return [parts[0], parts.slice(1).join(" ")];
}

function teamFame(name: string): number {
  if (BIG_CLUBS.has(name)) return 95;
  if (KNOWN_CLUBS.has(name)) return 72;
  return 38;
}

if (fs.existsSync(TEMP_DB)) fs.rmSync(TEMP_DB);
const db = new Database(TEMP_DB);
db.exec(fs.readFileSync(SCHEMA, "utf8"));

const insertSource = db.prepare(`
  INSERT INTO data_sources (id, name, url, license, retrieved_at)
  VALUES (?, ?, ?, ?, ?)
`);
insertSource.run("legacy-parcours", "Quizz Arena – banque Parcours", null, "internal", NOW);
insertSource.run("curated-wikidata", "Wikidata facts curated for Quizz Arena", "https://www.wikidata.org", "CC0", NOW);
insertSource.run("api-football", "API-Football", "https://www.api-football.com", "provider terms", NOW);

const insertCountry = db.prepare(`
  INSERT INTO countries (code, name, flag) VALUES (?, ?, ?)
  ON CONFLICT(code) DO UPDATE SET name = excluded.name, flag = excluded.flag
  RETURNING id
`);
const getCountry = db.prepare("SELECT id FROM countries WHERE code = ?");
const insertTeam = db.prepare(`
  INSERT INTO teams (canonical_name, normalized_name, team_type, country_id, fame_score)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(normalized_name, team_type) DO UPDATE SET
    canonical_name = excluded.canonical_name,
    country_id = COALESCE(teams.country_id, excluded.country_id),
    fame_score = MAX(teams.fame_score, excluded.fame_score)
  RETURNING id
`);
const getTeam = db.prepare("SELECT id FROM teams WHERE normalized_name = ? AND team_type = ?");
const insertTeamAlias = db.prepare(`
  INSERT OR IGNORE INTO team_aliases (team_id, alias, normalized_alias, language)
  VALUES (?, ?, ?, 'fr')
`);
const insertPlayer = db.prepare(`
  INSERT INTO players (
    display_name, given_name, family_name, normalized_name, birth_date,
    birth_date_precision, sporting_country_id, fame_score, game_eligible,
    profile_quality, career_quality, stats_quality, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'verified', ?, ?, ?)
  RETURNING id
`);
const getPlayer = db.prepare("SELECT id FROM players WHERE normalized_name = ?");
const updatePlayer = db.prepare(`
  UPDATE players SET
    display_name = ?,
    given_name = COALESCE(?, given_name),
    family_name = COALESCE(?, family_name),
    birth_date = COALESCE(?, birth_date),
    birth_date_precision = CASE WHEN ? IS NOT NULL THEN 'day' ELSE birth_date_precision END,
    sporting_country_id = COALESCE(?, sporting_country_id),
    fame_score = MAX(fame_score, ?),
    profile_quality = CASE WHEN ? IS NOT NULL THEN 'verified' ELSE profile_quality END,
    updated_at = ?
  WHERE id = ?
`);
const insertAlias = db.prepare(`
  INSERT OR IGNORE INTO player_aliases (
    player_id, alias, normalized_alias, language, alias_type
  ) VALUES (?, ?, ?, 'fr', ?)
`);
const insertSpell = db.prepare(`
  INSERT OR IGNORE INTO player_team_spells (
    player_id, team_id, start_date, end_date, date_precision, spell_type,
    senior_appearance_confirmed, source_id
  ) VALUES (?, ?, ?, ?, 'year', ?, 1, ?)
`);
const insertSnapshot = db.prepare(`
  INSERT OR REPLACE INTO player_team_stat_snapshots (
    player_id, team_id, scope, appearances, goals, assists, through_date,
    source_id, retrieved_at
  ) VALUES (?, ?, ?, ?, ?, NULL, ?, 'curated-wikidata', ?)
`);
const insertExternalId = db.prepare(`
  INSERT OR IGNORE INTO external_ids (entity_type, entity_id, provider, external_id)
  VALUES ('player', ?, ?, ?)
`);

function ensureCountry(country: { code: string; name: string; flag: string }): number {
  insertCountry.run(country.code, country.name, country.flag);
  return (getCountry.get(country.code) as { id: number }).id;
}

function ensureTeam(
  rawName: string,
  type: "club" | "national",
  countryId: number | null,
  fame: number
): number {
  const name = canonicalTeamName(rawName);
  const normalized = normalizeFootballText(name);
  insertTeam.run(name, normalized, type, countryId, fame);
  const id = (getTeam.get(normalized, type) as { id: number }).id;
  insertTeamAlias.run(id, rawName, normalizeFootballText(rawName));
  insertTeamAlias.run(id, name, normalized);
  return id;
}

function ensurePlayer(params: {
  name: string;
  aliases: string[];
  countryId: number;
  fame: number;
  birthDate?: string;
  givenName?: string | null;
  familyName?: string | null;
  sourceStats?: boolean;
}): number {
  const normalized = normalizeFootballText(params.name);
  const existing = getPlayer.get(normalized) as { id: number } | undefined;
  let id: number;
  if (existing) {
    id = existing.id;
    updatePlayer.run(
      params.name,
      params.givenName ?? null,
      params.familyName ?? null,
      params.birthDate ?? null,
      params.birthDate ?? null,
      params.countryId,
      params.fame,
      params.birthDate ?? null,
      NOW,
      id
    );
  } else {
    id = Number(insertPlayer.run(
      params.name,
      params.givenName ?? null,
      params.familyName ?? null,
      normalized,
      params.birthDate ?? null,
      params.birthDate ? "day" : "unknown",
      params.countryId,
      params.fame,
      params.birthDate ? "verified" : "partial",
      params.sourceStats ? "partial" : "missing",
      NOW,
      NOW
    ).lastInsertRowid);
  }
  insertAlias.run(id, params.name, normalized, "official");
  for (const alias of params.aliases) {
    const kind = alias.split(/\s+/).length === 1 ? "surname" : "common";
    insertAlias.run(id, alias, normalizeFootballText(alias), kind);
  }
  return id;
}

const seed = db.transaction(() => {
  const parcours = JSON.parse(fs.readFileSync(PARCOURS, "utf8")) as ParcoursSeed[];
  for (const entry of parcours) {
    const country = COUNTRY_BY_NAME[entry.nationality];
    if (!country) throw new Error(`Unknown country in Parcours: ${entry.nationality}`);
    const countryId = ensureCountry(country);
    const [givenName, familyName] = splitPlayerName(entry.playerName);
    const fame = entry.difficulty === "easy" ? 78 : entry.difficulty === "medium" ? 62 : 48;
    const playerId = ensurePlayer({
      name: entry.playerName,
      aliases: entry.acceptedAnswers,
      countryId,
      fame,
      givenName,
      familyName,
    });

    if (!NO_CONFIRMED_SENIOR_SELECTION.has(normalizeFootballText(entry.playerName))) {
      const nationalTeamId = ensureTeam(country.name, "national", countryId, 80);
      insertSpell.run(playerId, nationalTeamId, null, null, "international", "legacy-parcours");
    }

    for (const club of entry.clubs) {
      const name = canonicalTeamName(club.name);
      const teamId = ensureTeam(name, "club", null, teamFame(name));
      const [from, to] = parseYears(club.years);
      insertSpell.run(playerId, teamId, from, to, "permanent", "legacy-parcours");
    }
  }

  const core = JSON.parse(fs.readFileSync(CORE, "utf8")) as CorePlayer[];
  for (const entry of core) {
    const countryId = ensureCountry(entry.country);
    const playerId = ensurePlayer({
      name: entry.displayName,
      aliases: entry.aliases,
      countryId,
      fame: entry.fameScore,
      birthDate: entry.birthDate,
      givenName: entry.givenName,
      familyName: entry.familyName,
      sourceStats: true,
    });
    for (const [provider, externalId] of Object.entries(entry.externalIds ?? {})) {
      insertExternalId.run(playerId, provider, externalId);
    }

    const nationalTeamId = ensureTeam(entry.country.name, "national", countryId, 90);
    insertSpell.run(playerId, nationalTeamId, null, null, "international", "curated-wikidata");

    const explicitTotals = new Map((entry.clubTotals ?? []).map((total) => [
      normalizeFootballText(canonicalTeamName(total.name)),
      total,
    ]));
    for (const club of entry.clubs) {
      const clubCountry = club.countryCode ? COUNTRY_BY_CODE.get(club.countryCode) : undefined;
      const clubCountryId = clubCountry ? ensureCountry(clubCountry) : null;
      const name = canonicalTeamName(club.name);
      const teamId = ensureTeam(name, "club", clubCountryId, teamFame(name));
      insertSpell.run(playerId, teamId, club.from, club.to, "permanent", "curated-wikidata");

      const explicit = explicitTotals.get(normalizeFootballText(name));
      if (!explicit && club.appearances != null) {
        insertSnapshot.run(
          playerId, teamId, "domestic_league", club.appearances,
          club.goals ?? null, club.to, NOW
        );
      }
    }
    for (const total of entry.clubTotals ?? []) {
      const name = canonicalTeamName(total.name);
      const teamId = ensureTeam(name, "club", null, teamFame(name));
      insertSnapshot.run(
        playerId, teamId, total.scope, total.appearances,
        total.goals, null, NOW
      );
    }
  }
});

seed();
const connectionCount = rebuildFootballConnections(db);
db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run("schema_version", "1");
db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run("generated_at", NOW);
db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run("connection_count", String(connectionCount));
db.pragma("foreign_key_check");
db.close();

fs.renameSync(TEMP_DB, FINAL_DB);

const verify = new Database(FINAL_DB, { readonly: true });
const counts = verify.prepare(`
  SELECT
    (SELECT COUNT(*) FROM players) AS players,
    (SELECT COUNT(*) FROM teams WHERE team_type = 'club') AS clubs,
    (SELECT COUNT(*) FROM player_team_spells) AS spells,
    (SELECT COUNT(*) FROM football_connection_questions) AS connections
`).get();
verify.close();
console.log(JSON.stringify(counts, null, 2));
