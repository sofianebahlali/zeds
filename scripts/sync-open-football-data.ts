import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  downloadOpenSource,
  forEachCsvRow,
  type OpenSourceFile,
} from "./lib/open-football-data";
import {
  normalizeFootballText,
  rebuildFootballConnections,
} from "./lib/football-connections";

const ROOT = path.resolve(__dirname, "..");
const DATABASE_PATH = path.join(ROOT, "data/football.db");
const IMPORT_PATH = path.join(ROOT, "data/football.db.open-import");
const CACHE_DIRECTORY = path.join(ROOT, ".cache/football-open");
const TOP_FIVE = new Set(["GB1", "ES1", "IT1", "L1", "FR1"]);
const NOW = new Date().toISOString();

const WEEKLY_BASE = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data";
const HISTORICAL_BASE =
  "https://raw.githubusercontent.com/salimt/football-datasets/main/datalake/transfermarkt";
const HISTORICAL_MEDIA_BASE =
  "https://media.githubusercontent.com/media/salimt/football-datasets/main/datalake/transfermarkt";

const sources: OpenSourceFile[] = [
  { id: "weekly-players", url: `${WEEKLY_BASE}/players.csv.gz`, gzip: true },
  { id: "weekly-clubs", url: `${WEEKLY_BASE}/clubs.csv.gz`, gzip: true },
  { id: "weekly-competitions", url: `${WEEKLY_BASE}/competitions.csv.gz`, gzip: true },
  { id: "weekly-games", url: `${WEEKLY_BASE}/games.csv.gz`, gzip: true },
  { id: "weekly-appearances", url: `${WEEKLY_BASE}/appearances.csv.gz`, gzip: true },
  { id: "weekly-countries", url: `${WEEKLY_BASE}/countries.csv.gz`, gzip: true },
  { id: "weekly-national-teams", url: `${WEEKLY_BASE}/national_teams.csv.gz`, gzip: true },
  {
    id: "historical-profiles",
    url: `${HISTORICAL_BASE}/player_profiles/player_profiles.csv`,
  },
  {
    id: "historical-performances",
    url: `${HISTORICAL_MEDIA_BASE}/player_performances/player_performances.csv`,
  },
  {
    id: "historical-national-performances",
    url: `${HISTORICAL_BASE}/player_national_performances/player_national_performances.csv`,
  },
];

interface WeeklyPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  name: string;
  last_season: string;
  current_club_id: string;
  country_of_birth: string;
  country_of_citizenship: string;
  date_of_birth: string;
  sub_position: string;
  position: string;
  foot: string;
  height_in_cm: string;
  international_caps: string;
  international_goals: string;
  current_national_team_id: string;
  current_club_domestic_competition_id: string;
  current_club_name: string;
  market_value_in_eur: string;
  highest_market_value_in_eur: string;
}

interface HistoricalProfile {
  player_id: string;
  player_name: string;
  name_in_home_country: string;
  date_of_birth: string;
  country_of_birth: string;
  citizenship: string;
  height: string;
  position: string;
  main_position: string;
  foot: string;
  current_club_id: string;
  current_club_name: string;
}

interface CompetitionRow {
  competition_id: string;
  name: string;
  type: string;
  sub_type: string;
  country_id: string;
  country_name: string;
}

interface ClubRow {
  club_id: string;
  name: string;
  domestic_competition_id: string;
  total_market_value: string;
  last_season: string;
}

interface GameRow {
  game_id: string;
  competition_id: string;
  season: string;
  date: string;
  competition_type: string;
}

interface AppearanceRow {
  game_id: string;
  player_id: string;
  player_club_id: string;
  date: string;
  competition_id: string;
  yellow_cards: string;
  red_cards: string;
  goals: string;
  assists: string;
  minutes_played: string;
}

interface HistoricalPerformance {
  player_id: string;
  season_name: string;
  competition_id: string;
  competition_name: string;
  team_id: string;
  team_name: string;
  nb_in_group: string;
  nb_on_pitch: string;
  goals: string;
  assists: string;
  subed_in: string;
  yellow_cards: string;
  second_yellow_cards: string;
  direct_red_cards: string;
  minutes_played: string;
  clean_sheets: string;
}

interface CountryRow {
  country_id: string;
  country_name: string;
  country_code: string;
}

interface NationalTeamRow {
  national_team_id: string;
  name: string;
  country_id: string;
  country_name: string;
  country_code: string;
}

interface NationalPerformanceRow {
  player_id: string;
  team_id: string;
  matches: string;
  goals: string;
}

interface StatAggregate {
  playerExternalId: string;
  teamExternalId: string;
  teamName: string;
  competitionExternalId: string;
  competitionName: string;
  season: string;
  firstDate: string;
  lastDate: string;
  appearances: number;
  starts: number | null;
  substitutes: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  yellowCards: number | null;
  redCards: number | null;
  cleanSheets: number | null;
  sourcePriority: number;
}

function numberOrNull(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "" || value.trim() === "-") return null;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: string | null | undefined): number {
  return Math.max(0, Math.round(numberOrNull(value) ?? 0));
}

function cleanPlayerName(value: string): string {
  return value.replace(/\s+\(\d+\)\s*$/, "").trim();
}

function normalizeBirthDate(value: string): string | null {
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (iso) return iso;
  const european = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return european ? `${european[3]}-${european[2]}-${european[1]}` : null;
}

function normalizeSeason(value: string): { label: string; start: string; end: string } {
  const year = /^\d{4}$/.test(value)
    ? Number(value)
    : (() => {
        const short = value.match(/^(\d{2})\/(\d{2})$/);
        if (!short) return 2000;
        const first = Number(short[1]);
        return first >= 70 ? 1900 + first : 2000 + first;
      })();
  return {
    label: `${year}-${String(year + 1).slice(-2)}`,
    start: `${year}-07-01`,
    end: `${year + 1}-06-30`,
  };
}

function teamType(name: string): "club" | "reserve" | "youth" {
  if (/\b(U-?\d{2}|U-?\d|Under \d{2}|Youth)\b/i.test(name)) return "youth";
  if (/\b(II|B|Reserves?)\b/i.test(name)) return "reserve";
  return "club";
}

const TEAM_CANONICAL: Record<string, string> = {
  "fc barcelona": "FC Barcelone",
  "fc barcelone": "FC Barcelone",
  "paris saint germain football club": "Paris Saint-Germain",
  "paris saint germain": "Paris Saint-Germain",
  "fc bayern munich": "Bayern Munich",
  "fc bayern munchen": "Bayern Munich",
  "bayern munich": "Bayern Munich",
  "inter milan": "Inter Milan",
  "inter milan fc": "Inter Milan",
  "fc internazionale milano": "Inter Milan",
  "olympique de marseille": "Olympique de Marseille",
  "olympique lyon": "Olympique Lyonnais",
  "olympique lyonnais": "Olympique Lyonnais",
  "manchester united football club": "Manchester United",
  "liverpool fc": "Liverpool",
  "liverpool football club": "Liverpool",
  "arsenal fc": "Arsenal",
  "everton fc": "Everton",
  "watford fc": "Watford",
  "fulham fc": "Fulham",
  "acf fiorentina": "Fiorentina",
  "ssc napoli": "Napoli",
  "societa sportiva lazio s p a": "Lazio",
  "associazione sportiva roma": "AS Roma",
  "us sassuolo": "Sassuolo",
  "parma calcio 1913": "Parma",
  "delfino pescara 1936": "Pescara",
  "fc empoli": "Empoli",
  "rcd espanyol barcelona": "Espanyol",
  "atletico de madrid": "Atlético Madrid",
  "losc lille": "Lille OSC",
  "stade rennais fc": "Stade Rennais",
  "olympique marseille": "Olympique de Marseille",
  "fc toulouse": "Toulouse FC",
  "fc internazionale": "Inter Milan",
  "internazionale milano": "Inter Milan",
  "1 fsv mainz 05": "Mainz 05",
  "real madrid club de futbol": "Real Madrid",
};

const COUNTRY_CANONICAL: Record<string, string> = {
  germany: "Allemagne",
  spain: "Espagne",
  italy: "Italie",
  england: "Angleterre",
  netherlands: "Pays-Bas",
  belgium: "Belgique",
  brazil: "Brésil",
  argentina: "Argentine",
  colombia: "Colombie",
  senegal: "Sénégal",
  algeria: "Algérie",
  switzerland: "Suisse",
  "ivory coast": "Côte d’Ivoire",
  "cote d ivoire": "Côte d’Ivoire",
  "united states": "États-Unis",
  uruguay: "Uruguay",
  paraguay: "Paraguay",
  turkey: "Turquie",
  turkiye: "Turquie",
  "czech republic": "Tchéquie",
  "south korea": "Corée du Sud",
  "saudi arabia": "Arabie saoudite",
  greece: "Grèce",
  austria: "Autriche",
  croatia: "Croatie",
  serbia: "Serbie",
  poland: "Pologne",
  sweden: "Suède",
  norway: "Norvège",
  denmark: "Danemark",
  finland: "Finlande",
  hungary: "Hongrie",
  romania: "Roumanie",
  slovakia: "Slovaquie",
  slovenia: "Slovénie",
  morocco: "Maroc",
  tunisia: "Tunisie",
  egypt: "Égypte",
  japan: "Japon",
  china: "Chine",
  russia: "Russie",
  ukraine: "Ukraine",
  mexico: "Mexique",
  chile: "Chili",
  peru: "Pérou",
  ecuador: "Équateur",
  albania: "Albanie",
  iceland: "Islande",
  israel: "Israël",
  "north macedonia": "Macédoine du Nord",
};

function canonicalTeamName(value: string): string {
  return TEAM_CANONICAL[normalizeFootballText(value)] ?? cleanPlayerName(value);
}

function canonicalCountryName(value: string): string {
  const trimmed = value.trim();
  return COUNTRY_CANONICAL[normalizeFootballText(trimmed)] ?? trimmed;
}

function competitionType(value: string): "league" | "cup" | "continental" | "international" {
  if (value === "domestic_league") return "league";
  if (value === "domestic_cup") return "cup";
  if (value === "national_team_competition") return "international";
  return "continental";
}

function clubFame(club: ClubRow | undefined): number {
  const marketValue = numberOrNull(club?.total_market_value);
  if (marketValue != null) {
    if (marketValue >= 800_000_000) return 100;
    if (marketValue >= 400_000_000) return 95;
    if (marketValue >= 200_000_000) return 88;
    if (marketValue >= 80_000_000) return 80;
  }
  if (club && TOP_FIVE.has(club.domestic_competition_id)) {
    const lastSeason = Number(club.last_season);
    if (lastSeason >= 2024) return 75;
    if (lastSeason >= 2020) return 65;
    return 55;
  }
  return 42;
}

function playerFame(
  player: WeeklyPlayer | undefined,
  topFiveAppearances: number
): number {
  const peakValue = numberOrNull(player?.highest_market_value_in_eur)
    ?? numberOrNull(player?.market_value_in_eur)
    ?? 0;
  const caps = integer(player?.international_caps);
  let score = 35;
  if (topFiveAppearances >= 300) score = 96;
  else if (topFiveAppearances >= 200) score = 90;
  else if (topFiveAppearances >= 120) score = 84;
  else if (topFiveAppearances >= 70) score = 76;
  else if (topFiveAppearances >= 35) score = 68;
  else if (topFiveAppearances >= 15) score = 58;
  else if (topFiveAppearances >= 5) score = 50;

  if (peakValue >= 100_000_000) score = Math.max(score, 98);
  else if (peakValue >= 60_000_000) score = Math.max(score, 92);
  else if (peakValue >= 30_000_000) score = Math.max(score, 86);
  else if (peakValue >= 15_000_000) score = Math.max(score, 78);
  else if (peakValue >= 5_000_000) score = Math.max(score, 68);
  else if (peakValue >= 1_000_000) score = Math.max(score, 58);

  if (caps >= 100) score = Math.max(score, 92);
  else if (caps >= 50) score = Math.max(score, 82);
  else if (caps >= 20) score = Math.max(score, 72);
  else if (caps >= 5) score = Math.max(score, 60);
  return Math.min(100, score);
}

async function main() {
  if (!fs.existsSync(DATABASE_PATH)) {
    throw new Error("data/football.db est absent. Lance npm run football:build d’abord.");
  }

  const files = new Map<string, { path: string; retrievedAt: string }>();
  for (const source of sources) {
    process.stdout.write(`Téléchargement ${source.id}... `);
    const downloaded = await downloadOpenSource(source, CACHE_DIRECTORY);
    files.set(source.id, {
      path: downloaded.path,
      retrievedAt: downloaded.metadata.retrievedAt,
    });
    console.log(downloaded.changed ? "mis à jour" : "cache valide");
  }

  const weeklyPlayers = new Map<string, WeeklyPlayer>();
  const competitions = new Map<string, CompetitionRow>();
  const clubs = new Map<string, ClubRow>();
  const games = new Map<string, GameRow>();
  const countries = new Map<string, CountryRow>();
  const nationalTeams = new Map<string, NationalTeamRow>();
  const selectedPlayerIds = new Set<string>();
  const topFiveAppearances = new Map<string, number>();
  const historicalTopFiveAppearances = new Map<string, number>();

  await forEachCsvRow<CompetitionRow>(
    files.get("weekly-competitions")!.path,
    true,
    (row) => { competitions.set(row.competition_id, row); }
  );
  await forEachCsvRow<ClubRow>(
    files.get("weekly-clubs")!.path,
    true,
    (row) => { clubs.set(row.club_id, row); }
  );
  await forEachCsvRow<GameRow>(
    files.get("weekly-games")!.path,
    true,
    (row) => { games.set(row.game_id, row); }
  );
  await forEachCsvRow<CountryRow>(
    files.get("weekly-countries")!.path,
    true,
    (row) => { countries.set(row.country_id, row); }
  );
  await forEachCsvRow<NationalTeamRow>(
    files.get("weekly-national-teams")!.path,
    true,
    (row) => { nationalTeams.set(row.national_team_id, row); }
  );
  await forEachCsvRow<WeeklyPlayer>(
    files.get("weekly-players")!.path,
    true,
    (row) => { weeklyPlayers.set(row.player_id, row); }
  );

  console.log("Repérage des joueurs ayant évolué dans les cinq grands championnats...");
  await forEachCsvRow<AppearanceRow>(
    files.get("weekly-appearances")!.path,
    true,
    (row) => {
      if (!TOP_FIVE.has(row.competition_id)) return;
      selectedPlayerIds.add(row.player_id);
      topFiveAppearances.set(
        row.player_id,
        (topFiveAppearances.get(row.player_id) ?? 0) + 1
      );
    }
  );
  await forEachCsvRow<HistoricalPerformance>(
    files.get("historical-performances")!.path,
    false,
    (row) => {
      if (!TOP_FIVE.has(row.competition_id)) return;
      selectedPlayerIds.add(row.player_id);
      historicalTopFiveAppearances.set(
        row.player_id,
        (historicalTopFiveAppearances.get(row.player_id) ?? 0) + integer(row.nb_on_pitch)
      );
    }
  );
  for (const [playerId, appearances] of historicalTopFiveAppearances) {
    topFiveAppearances.set(
      playerId,
      Math.max(topFiveAppearances.get(playerId) ?? 0, appearances)
    );
  }

  // Include every recent squad profile, even if the player has not made a
  // first-team appearance yet. Such a player is stored but cannot generate a
  // connection until an appearance is confirmed.
  const latestSeason = Math.max(
    ...Array.from(games.values())
      .filter((game) => TOP_FIVE.has(game.competition_id))
      .map((game) => Number(game.season))
  );
  for (const player of weeklyPlayers.values()) {
    if (
      TOP_FIVE.has(player.current_club_domestic_competition_id)
      && Number(player.last_season) >= latestSeason
    ) {
      selectedPlayerIds.add(player.player_id);
    }
  }
  console.log(`${selectedPlayerIds.size.toLocaleString("fr-FR")} joueurs sélectionnés.`);

  if (fs.existsSync(IMPORT_PATH)) fs.rmSync(IMPORT_PATH);
  fs.copyFileSync(DATABASE_PATH, IMPORT_PATH);
  const db = new Database(IMPORT_PATH);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.prepare(`
    INSERT INTO data_sources (id, name, url, license, retrieved_at)
    VALUES (?, ?, ?, 'CC0-1.0', ?)
    ON CONFLICT(id) DO UPDATE SET retrieved_at = excluded.retrieved_at
  `).run(
    "open-transfermarkt",
    "transfermarkt-datasets – weekly open dataset",
    "https://github.com/dcaribou/transfermarkt-datasets",
    files.get("weekly-players")!.retrievedAt
  );
  db.prepare(`
    INSERT INTO data_sources (id, name, url, license, retrieved_at)
    VALUES (?, ?, ?, 'CC0 dataset publication', ?)
    ON CONFLICT(id) DO UPDATE SET retrieved_at = excluded.retrieved_at
  `).run(
    "open-transfermarkt-history",
    "football-datasets – historical performance archive",
    "https://github.com/salimt/football-datasets",
    files.get("historical-profiles")!.retrievedAt
  );

  const existingCountries = new Map<string, number>();
  for (const row of db.prepare("SELECT id, name FROM countries").all() as { id: number; name: string }[]) {
    existingCountries.set(normalizeFootballText(row.name), row.id);
  }
  const insertCountry = db.prepare("INSERT INTO countries (code, name) VALUES (?, ?)");
  function ensureCountry(name: string, preferredCode?: string): number | null {
    if (!name.trim()) return null;
    const canonicalName = canonicalCountryName(name);
    const normalized = normalizeFootballText(canonicalName);
    const existing = existingCountries.get(normalized);
    if (existing) return existing;
    let code = preferredCode || `TM-${normalized.toUpperCase().replace(/\s+/g, "-").slice(0, 24)}`;
    const collision = db.prepare("SELECT id FROM countries WHERE code = ?").get(code) as { id: number } | undefined;
    if (collision) code = `${code}-${existingCountries.size + 1}`;
    const id = Number(insertCountry.run(code, canonicalName).lastInsertRowid);
    existingCountries.set(normalized, id);
    return id;
  }

  for (const country of countries.values()) {
    ensureCountry(country.country_name, `TM-${country.country_id}`);
  }

  const findExternal = db.prepare(`
    SELECT entity_id FROM external_ids
    WHERE entity_type = ? AND provider = 'transfermarkt' AND external_id = ?
  `);
  const addExternal = db.prepare(`
    INSERT OR IGNORE INTO external_ids (entity_type, entity_id, provider, external_id)
    VALUES (?, ?, 'transfermarkt', ?)
  `);
  const findTeamByName = db.prepare(`
    SELECT id FROM teams WHERE normalized_name = ? AND team_type = ?
  `);
  const insertTeam = db.prepare(`
    INSERT INTO teams (
      canonical_name, normalized_name, team_type, country_id, fame_score
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const updateTeam = db.prepare(`
    UPDATE teams SET
      country_id = COALESCE(country_id, ?),
      fame_score = MAX(fame_score, ?)
    WHERE id = ?
  `);
  const insertTeamAlias = db.prepare(`
    INSERT OR IGNORE INTO team_aliases (team_id, alias, normalized_alias)
    VALUES (?, ?, ?)
  `);

  function ensureTeam(
    externalId: string,
    rawName: string,
    type: "club" | "reserve" | "youth" | "national",
    countryId: number | null,
    fame: number
  ): number {
    const external = findExternal.get("team", externalId) as { entity_id: number } | undefined;
    if (external) {
      updateTeam.run(countryId, fame, external.entity_id);
      return external.entity_id;
    }
    const name = canonicalTeamName(rawName);
    const normalized = normalizeFootballText(name);
    const byName = findTeamByName.get(normalized, type) as { id: number } | undefined;
    const id = byName?.id ?? Number(insertTeam.run(
      name,
      normalized,
      type,
      countryId,
      fame
    ).lastInsertRowid);
    updateTeam.run(countryId, fame, id);
    addExternal.run("team", id, externalId);
    insertTeamAlias.run(id, rawName, normalizeFootballText(rawName));
    insertTeamAlias.run(id, name, normalized);
    return id;
  }

  const teamIds = new Map<string, number>();
  for (const club of clubs.values()) {
    const competition = competitions.get(club.domestic_competition_id);
    const countryId = ensureCountry(competition?.country_name ?? "");
    teamIds.set(club.club_id, ensureTeam(
      club.club_id,
      club.name,
      teamType(club.name),
      countryId,
      clubFame(club)
    ));
  }
  for (const team of nationalTeams.values()) {
    const countryId = ensureCountry(team.country_name, `TM-${team.country_id}`);
    teamIds.set(team.national_team_id, ensureTeam(
      team.national_team_id,
      canonicalCountryName(team.name),
      "national",
      countryId,
      75
    ));
  }

  const findCompetitionByName = db.prepare(`
    SELECT id FROM competitions WHERE canonical_name = ? AND country_id IS ?
  `);
  const insertCompetition = db.prepare(`
    INSERT INTO competitions (
      canonical_name, country_id, competition_type, level
    ) VALUES (?, ?, ?, ?)
  `);
  const competitionIds = new Map<string, number>();
  function ensureCompetition(
    externalId: string,
    name: string,
    countryId: number | null,
    type: "league" | "cup" | "continental" | "international" = "continental"
  ): number {
    const known = competitionIds.get(externalId);
    if (known) return known;
    const external = findExternal.get("competition", externalId) as { entity_id: number } | undefined;
    if (external) {
      competitionIds.set(externalId, external.entity_id);
      return external.entity_id;
    }
    const existing = findCompetitionByName.get(name, countryId) as { id: number } | undefined;
    const id = existing?.id ?? Number(insertCompetition.run(
      name,
      countryId,
      type,
      TOP_FIVE.has(externalId) ? 1 : null
    ).lastInsertRowid);
    addExternal.run("competition", id, externalId);
    competitionIds.set(externalId, id);
    return id;
  }

  for (const competition of competitions.values()) {
    ensureCompetition(
      competition.competition_id,
      competition.name,
      ensureCountry(competition.country_name),
      competitionType(competition.type)
    );
  }

  const findPlayerByIdentity = db.prepare(`
    SELECT id FROM players
    WHERE normalized_name = ?
      AND (birth_date = ? OR birth_date IS NULL OR ? IS NULL)
    ORDER BY game_eligible DESC, fame_score DESC
    LIMIT 1
  `);
  const insertPlayer = db.prepare(`
    INSERT INTO players (
      display_name, given_name, family_name, normalized_name, birth_date,
      birth_date_precision, birth_country_id, sporting_country_id, primary_position,
      height_cm, preferred_foot, fame_score, game_eligible, profile_quality,
      career_quality, stats_quality, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'partial', 'missing', ?, ?)
  `);
  const updatePlayer = db.prepare(`
    UPDATE players SET
      display_name = CASE WHEN length(?) > length(display_name) THEN ? ELSE display_name END,
      given_name = COALESCE(given_name, ?),
      family_name = COALESCE(family_name, ?),
      birth_date = COALESCE(birth_date, ?),
      birth_date_precision = CASE WHEN birth_date IS NULL AND ? IS NOT NULL THEN 'day' ELSE birth_date_precision END,
      birth_country_id = COALESCE(birth_country_id, ?),
      sporting_country_id = COALESCE(sporting_country_id, ?),
      primary_position = COALESCE(primary_position, ?),
      height_cm = COALESCE(height_cm, ?),
      preferred_foot = COALESCE(preferred_foot, ?),
      fame_score = MAX(fame_score, ?),
      profile_quality = CASE WHEN COALESCE(birth_date, ?) IS NOT NULL THEN 'verified' ELSE profile_quality END,
      updated_at = ?
    WHERE id = ?
  `);
  const insertPlayerAlias = db.prepare(`
    INSERT OR IGNORE INTO player_aliases (
      player_id, alias, normalized_alias, language, alias_type
    ) VALUES (?, ?, ?, NULL, ?)
  `);
  const playerIds = new Map<string, number>();

  function ensurePlayer(params: {
    externalId: string;
    displayName: string;
    givenName?: string;
    familyName?: string;
    homeName?: string;
    birthDate: string | null;
    birthCountry?: string;
    sportingCountry?: string;
    position?: string;
    height?: number | null;
    foot?: string;
  }): number {
    const known = playerIds.get(params.externalId);
    if (known) return known;
    const external = findExternal.get("player", params.externalId) as { entity_id: number } | undefined;
    const normalized = normalizeFootballText(params.displayName);
    const matchedIdentity = findPlayerByIdentity.get(
      normalized,
      params.birthDate,
      params.birthDate
    ) as { id: number } | undefined;
    const existingPlayerId = external?.entity_id ?? matchedIdentity?.id;
    const birthCountryId = ensureCountry(params.birthCountry ?? "");
    const sportingCountryId = ensureCountry(params.sportingCountry ?? "");
    const fame = playerFame(
      weeklyPlayers.get(params.externalId),
      topFiveAppearances.get(params.externalId) ?? 0
    );
    const id = existingPlayerId ?? Number(insertPlayer.run(
      params.displayName,
      params.givenName || null,
      params.familyName || null,
      normalized,
      params.birthDate,
      params.birthDate ? "day" : "unknown",
      birthCountryId,
      sportingCountryId,
      params.position || null,
      params.height ?? null,
      params.foot || null,
      fame,
      params.birthDate ? "verified" : "partial",
      NOW,
      NOW
    ).lastInsertRowid);
    updatePlayer.run(
      params.displayName,
      params.displayName,
      params.givenName || null,
      params.familyName || null,
      params.birthDate,
      params.birthDate,
      birthCountryId,
      sportingCountryId,
      params.position || null,
      params.height ?? null,
      params.foot || null,
      fame,
      params.birthDate,
      NOW,
      id
    );
    addExternal.run("player", id, params.externalId);
    insertPlayerAlias.run(id, params.displayName, normalized, "official");
    if (params.homeName && normalizeFootballText(params.homeName) !== normalized) {
      insertPlayerAlias.run(id, params.homeName, normalizeFootballText(params.homeName), "transliteration");
    }
    if (params.familyName && normalizeFootballText(params.familyName).length >= 4) {
      insertPlayerAlias.run(id, params.familyName, normalizeFootballText(params.familyName), "surname");
    }
    playerIds.set(params.externalId, id);
    return id;
  }

  for (const externalId of selectedPlayerIds) {
    const player = weeklyPlayers.get(externalId);
    if (!player) continue;
    ensurePlayer({
      externalId,
      displayName: player.name,
      givenName: player.first_name,
      familyName: player.last_name,
      birthDate: normalizeBirthDate(player.date_of_birth),
      birthCountry: player.country_of_birth,
      sportingCountry: player.country_of_citizenship,
      position: player.sub_position || player.position,
      height: numberOrNull(player.height_in_cm),
      foot: player.foot,
    });
  }

  await forEachCsvRow<HistoricalProfile>(
    files.get("historical-profiles")!.path,
    false,
    (profile) => {
      if (!selectedPlayerIds.has(profile.player_id)) return;
      const displayName = cleanPlayerName(profile.player_name);
      const parts = displayName.split(/\s+/);
      ensurePlayer({
        externalId: profile.player_id,
        displayName,
        givenName: parts[0],
        familyName: parts.slice(1).join(" "),
        homeName: profile.name_in_home_country,
        birthDate: normalizeBirthDate(profile.date_of_birth),
        birthCountry: profile.country_of_birth,
        sportingCountry: profile.citizenship.split(",")[0]?.trim(),
        position: profile.position || profile.main_position,
        height: numberOrNull(profile.height),
        foot: profile.foot,
      });
    }
  );

  // Current squad membership is useful metadata, but cannot become a playable
  // connection until an appearance row confirms the senior relationship.
  const insertSpell = db.prepare(`
    INSERT OR IGNORE INTO player_team_spells (
      player_id, team_id, start_date, end_date, date_precision, spell_type,
      senior_appearance_confirmed, source_id, source_ref
    ) VALUES (?, ?, ?, ?, 'year', ?, ?, ?, ?)
  `);
  for (const [externalId, internalId] of playerIds) {
    const profile = weeklyPlayers.get(externalId);
    if (!profile?.current_club_id || !profile.current_club_name) continue;
    const club = clubs.get(profile.current_club_id);
    const teamId = teamIds.get(profile.current_club_id) ?? ensureTeam(
      profile.current_club_id,
      profile.current_club_name,
      teamType(profile.current_club_name),
      ensureCountry(competitions.get(club?.domestic_competition_id ?? "")?.country_name ?? ""),
      clubFame(club)
    );
    teamIds.set(profile.current_club_id, teamId);
    insertSpell.run(
      internalId,
      teamId,
      profile.last_season || null,
      null,
      "permanent",
      0,
      "open-transfermarkt",
      `current:${externalId}:${profile.current_club_id}`
    );
  }

  const findSeason = db.prepare("SELECT id FROM seasons WHERE competition_id = ? AND label = ?");
  const insertSeason = db.prepare(`
    INSERT INTO seasons (competition_id, label, start_date, end_date)
    VALUES (?, ?, ?, ?)
  `);
  const seasonIds = new Map<string, number>();
  function ensureSeason(competitionId: number, rawSeason: string): number {
    const normalized = normalizeSeason(rawSeason);
    const key = `${competitionId}:${normalized.label}`;
    const known = seasonIds.get(key);
    if (known) return known;
    const existing = findSeason.get(competitionId, normalized.label) as { id: number } | undefined;
    const id = existing?.id ?? Number(insertSeason.run(
      competitionId,
      normalized.label,
      normalized.start,
      normalized.end
    ).lastInsertRowid);
    seasonIds.set(key, id);
    return id;
  }

  const upsertStats = db.prepare(`
    INSERT INTO player_season_stats (
      player_id, team_id, competition_id, season_id, appearances, starts,
      substitute_appearances, minutes, goals, assists, yellow_cards, red_cards,
      clean_sheets, coverage_complete, source_id, retrieved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'open-transfermarkt', ?)
    ON CONFLICT(player_id, team_id, competition_id, season_id, source_id)
    DO UPDATE SET
      appearances = excluded.appearances,
      starts = excluded.starts,
      substitute_appearances = excluded.substitute_appearances,
      minutes = excluded.minutes,
      goals = excluded.goals,
      assists = excluded.assists,
      yellow_cards = excluded.yellow_cards,
      red_cards = excluded.red_cards,
      clean_sheets = excluded.clean_sheets,
      coverage_complete = 1,
      retrieved_at = excluded.retrieved_at
  `);

  function importStat(stat: StatAggregate) {
    const playerId = playerIds.get(stat.playerExternalId);
    if (!playerId || stat.appearances <= 0) return;
    const club = clubs.get(stat.teamExternalId);
    const teamId = teamIds.get(stat.teamExternalId) ?? ensureTeam(
      stat.teamExternalId,
      stat.teamName,
      teamType(stat.teamName),
      ensureCountry(competitions.get(club?.domestic_competition_id ?? "")?.country_name ?? ""),
      clubFame(club)
    );
    teamIds.set(stat.teamExternalId, teamId);
    const competition = competitions.get(stat.competitionExternalId);
    const competitionId = ensureCompetition(
      stat.competitionExternalId,
      competition?.name || stat.competitionName || stat.competitionExternalId,
      ensureCountry(competition?.country_name ?? ""),
      competitionType(competition?.type ?? "")
    );
    const seasonId = ensureSeason(competitionId, stat.season);
    upsertStats.run(
      playerId,
      teamId,
      competitionId,
      seasonId,
      stat.appearances,
      stat.starts,
      stat.substitutes,
      stat.minutes,
      stat.goals,
      stat.assists,
      stat.yellowCards,
      stat.redCards,
      stat.cleanSheets,
      NOW
    );
    const season = normalizeSeason(stat.season);
    insertSpell.run(
      playerId,
      teamId,
      stat.firstDate || season.start,
      stat.lastDate || season.end,
      "permanent",
      1,
      stat.sourcePriority > 1 ? "open-transfermarkt" : "open-transfermarkt-history",
      `${stat.playerExternalId}:${stat.teamExternalId}:${season.label}`
    );
  }

  const batch: StatAggregate[] = [];
  const flushBatch = db.transaction(() => {
    for (const stat of batch) importStat(stat);
    batch.length = 0;
  });

  console.log("Import des performances historiques...");
  await forEachCsvRow<HistoricalPerformance>(
    files.get("historical-performances")!.path,
    false,
    (row) => {
      if (!selectedPlayerIds.has(row.player_id)) return;
      const appearances = integer(row.nb_on_pitch);
      if (appearances <= 0 || !row.team_id) return;
      batch.push({
        playerExternalId: row.player_id,
        teamExternalId: row.team_id,
        teamName: row.team_name,
        competitionExternalId: row.competition_id,
        competitionName: row.competition_name,
        season: row.season_name,
        firstDate: "",
        lastDate: "",
        appearances,
        starts: null,
        substitutes: numberOrNull(row.subed_in),
        minutes: numberOrNull(row.minutes_played),
        goals: numberOrNull(row.goals),
        assists: numberOrNull(row.assists),
        yellowCards: numberOrNull(row.yellow_cards),
        redCards: integer(row.second_yellow_cards) + integer(row.direct_red_cards),
        cleanSheets: numberOrNull(row.clean_sheets),
        sourcePriority: 1,
      });
      if (batch.length >= 5_000) flushBatch();
    }
  );
  if (batch.length) flushBatch();

  console.log("Agrégation des apparitions récentes...");
  const recentStats = new Map<string, StatAggregate>();
  await forEachCsvRow<AppearanceRow>(
    files.get("weekly-appearances")!.path,
    true,
    (row) => {
      if (!selectedPlayerIds.has(row.player_id) || !row.player_club_id) return;
      const game = games.get(row.game_id);
      if (!game || game.competition_type === "national_team_competition") return;
      const key = `${row.player_id}:${row.player_club_id}:${row.competition_id}:${game.season}`;
      const current = recentStats.get(key) ?? {
        playerExternalId: row.player_id,
        teamExternalId: row.player_club_id,
        teamName: clubs.get(row.player_club_id)?.name ?? `Club ${row.player_club_id}`,
        competitionExternalId: row.competition_id,
        competitionName: competitions.get(row.competition_id)?.name ?? row.competition_id,
        season: game.season,
        firstDate: row.date,
        lastDate: row.date,
        appearances: 0,
        starts: null,
        substitutes: null,
        minutes: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        cleanSheets: null,
        sourcePriority: 2,
      };
      current.firstDate = !current.firstDate || row.date < current.firstDate ? row.date : current.firstDate;
      current.lastDate = row.date > current.lastDate ? row.date : current.lastDate;
      current.appearances += 1;
      current.minutes = (current.minutes ?? 0) + integer(row.minutes_played);
      current.goals = (current.goals ?? 0) + integer(row.goals);
      current.assists = (current.assists ?? 0) + integer(row.assists);
      current.yellowCards = (current.yellowCards ?? 0) + integer(row.yellow_cards);
      current.redCards = (current.redCards ?? 0) + integer(row.red_cards);
      recentStats.set(key, current);
    }
  );
  for (const stat of recentStats.values()) {
    batch.push(stat);
    if (batch.length >= 5_000) flushBatch();
  }
  if (batch.length) flushBatch();

  console.log("Import des sélections nationales confirmées...");
  const nationalStatsByPlayerTeam = new Map<string, { matches: number; goals: number }>();
  await forEachCsvRow<NationalPerformanceRow>(
    files.get("historical-national-performances")!.path,
    false,
    (row) => {
      if (!selectedPlayerIds.has(row.player_id) || !nationalTeams.has(row.team_id)) return;
      const key = `${row.player_id}:${row.team_id}`;
      const current = nationalStatsByPlayerTeam.get(key) ?? { matches: 0, goals: 0 };
      current.matches = Math.max(current.matches, integer(row.matches));
      current.goals = Math.max(current.goals, integer(row.goals));
      nationalStatsByPlayerTeam.set(key, current);
    }
  );
  const insertSnapshot = db.prepare(`
    INSERT INTO player_team_stat_snapshots (
      player_id, team_id, scope, appearances, goals, assists, through_date,
      source_id, retrieved_at
    ) VALUES (?, ?, 'all_official', ?, ?, NULL, ?, 'open-transfermarkt-history', ?)
    ON CONFLICT(player_id, team_id, scope, source_id)
    DO UPDATE SET appearances = excluded.appearances, goals = excluded.goals,
                  through_date = excluded.through_date, retrieved_at = excluded.retrieved_at
  `);
  const updateNationalFame = db.prepare(`
    UPDATE players SET fame_score = MAX(fame_score, ?) WHERE id = ?
  `);
  const importNational = db.transaction(() => {
    for (const [key, stats] of nationalStatsByPlayerTeam) {
      if (stats.matches <= 0) continue;
      const [playerExternalId, teamExternalId] = key.split(":");
      const playerId = playerIds.get(playerExternalId);
      const teamId = teamIds.get(teamExternalId);
      if (!playerId || !teamId) continue;
      insertSpell.run(
        playerId,
        teamId,
        null,
        null,
        "international",
        1,
        "open-transfermarkt-history",
        `national:${key}`
      );
      insertSnapshot.run(playerId, teamId, stats.matches, stats.goals, null, NOW);
      const nationalFame = stats.matches >= 100 ? 92
        : stats.matches >= 50 ? 82
        : stats.matches >= 20 ? 72
        : stats.matches >= 5 ? 60
        : 0;
      updateNationalFame.run(nationalFame, playerId);
    }
  });
  importNational();

  db.exec(`
    UPDATE players
    SET
      career_quality = CASE WHEN EXISTS (
        SELECT 1 FROM player_team_spells s
        WHERE s.player_id = players.id AND s.senior_appearance_confirmed = 1
      ) THEN 'verified' ELSE career_quality END,
      stats_quality = CASE WHEN EXISTS (
        SELECT 1 FROM player_season_stats st WHERE st.player_id = players.id
      ) THEN 'verified' ELSE stats_quality END,
      game_eligible = CASE
        WHEN fame_score >= 55 AND EXISTS (
          SELECT 1 FROM player_team_spells s
          JOIN teams t ON t.id = s.team_id
          WHERE s.player_id = players.id
            AND s.senior_appearance_confirmed = 1
            AND t.team_type = 'club'
        ) THEN 1
        ELSE game_eligible
      END
  `);

  const connectionCount = rebuildFootballConnections(db);
  db.prepare(`
    INSERT INTO metadata (key, value) VALUES ('open_data_generated_at', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(NOW);
  db.prepare(`
    INSERT INTO metadata (key, value) VALUES ('open_data_player_scope', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(selectedPlayerIds.size));
  db.prepare(`
    INSERT INTO metadata (key, value) VALUES ('connection_count', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(connectionCount));

  const foreignKeys = db.pragma("foreign_key_check") as unknown[];
  if (foreignKeys.length) throw new Error(`${foreignKeys.length} violations de clés étrangères`);
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  fs.renameSync(IMPORT_PATH, DATABASE_PATH);

  const verify = new Database(DATABASE_PATH, { readonly: true });
  const summary = verify.prepare(`
    SELECT
      (SELECT COUNT(*) FROM players) AS players,
      (SELECT COUNT(*) FROM players WHERE game_eligible = 1) AS eligiblePlayers,
      (SELECT COUNT(*) FROM teams WHERE team_type = 'club') AS clubs,
      (SELECT COUNT(*) FROM player_team_spells WHERE senior_appearance_confirmed = 1) AS spells,
      (SELECT COUNT(*) FROM player_season_stats) AS statRows,
      (SELECT COUNT(*) FROM football_connection_questions) AS connections
  `).get();
  verify.close();
  console.log("Import ouvert terminé :", summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
