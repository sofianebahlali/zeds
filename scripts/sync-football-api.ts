import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { rebuildFootballConnections, normalizeFootballText } from "./lib/football-connections";

type ApiPlayer = {
  player: {
    id: number;
    name: string;
    firstname: string | null;
    lastname: string | null;
    birth?: { date?: string | null; country?: string | null };
    nationality?: string | null;
    height?: string | null;
  };
  statistics: {
    team: { id: number; name: string };
    league: { id: number; name: string; country: string; season: number };
    games: {
      appearences: number | null;
      lineups: number | null;
      minutes: number | null;
      position: string | null;
    };
    substitutes: { in: number | null };
    goals: { total: number | null; assists: number | null };
    cards: { yellow: number | null; red: number | null };
  }[];
};

type ApiResponse = {
  errors: Record<string, string> | string[];
  paging: { current: number; total: number };
  response: ApiPlayer[];
};

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const league = Number(argument("league"));
const season = Number(argument("season"));
const maxPages = Number(argument("max-pages") ?? Number.MAX_SAFE_INTEGER);
const key = process.env.API_FOOTBALL_KEY;
const dbPath = path.resolve(__dirname, "../data/football.db");

if (!key) {
  throw new Error("API_FOOTBALL_KEY est requis (voir .env.example).");
}
if (!Number.isInteger(league) || !Number.isInteger(season)) {
  throw new Error("Usage: npm run football:sync-api -- --league=39 --season=2025 [--max-pages=2]");
}
if (!fs.existsSync(dbPath)) {
  throw new Error("data/football.db est absent. Lance d’abord npm run football:build.");
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

const now = new Date().toISOString();
db.prepare(`
  INSERT INTO data_sources (id, name, url, license, retrieved_at)
  VALUES ('api-football', 'API-Football', 'https://www.api-football.com', 'provider terms', ?)
  ON CONFLICT(id) DO UPDATE SET retrieved_at = excluded.retrieved_at
`).run(now);

const findExternal = db.prepare(`
  SELECT entity_id FROM external_ids
  WHERE entity_type = ? AND provider = 'api-football' AND external_id = ?
`);
const addExternal = db.prepare(`
  INSERT OR IGNORE INTO external_ids (entity_type, entity_id, provider, external_id)
  VALUES (?, ?, 'api-football', ?)
`);
const findPlayer = db.prepare(`
  SELECT id FROM players
  WHERE normalized_name = ?
    AND (birth_date = ? OR birth_date IS NULL OR ? IS NULL)
  ORDER BY game_eligible DESC, fame_score DESC
  LIMIT 1
`);
const insertPlayer = db.prepare(`
  INSERT INTO players (
    display_name, given_name, family_name, normalized_name, birth_date,
    birth_date_precision, sporting_country_id, height_cm, primary_position,
    fame_score, game_eligible, profile_quality, career_quality, stats_quality,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 20, 0, 'partial', 'partial', 'partial', ?, ?)
`);
const updatePlayer = db.prepare(`
  UPDATE players SET
    given_name = COALESCE(given_name, ?),
    family_name = COALESCE(family_name, ?),
    birth_date = COALESCE(birth_date, ?),
    birth_date_precision = CASE
      WHEN birth_date IS NULL AND ? IS NOT NULL THEN 'day'
      ELSE birth_date_precision
    END,
    sporting_country_id = COALESCE(sporting_country_id, ?),
    height_cm = COALESCE(height_cm, ?),
    primary_position = COALESCE(primary_position, ?),
    stats_quality = 'partial',
    updated_at = ?
  WHERE id = ?
`);
const insertAlias = db.prepare(`
  INSERT OR IGNORE INTO player_aliases
    (player_id, alias, normalized_alias, language, alias_type)
  VALUES (?, ?, ?, NULL, ?)
`);
const findCountry = db.prepare("SELECT id FROM countries WHERE code = ?");
const insertCountry = db.prepare("INSERT INTO countries (code, name) VALUES (?, ?)");
const findTeam = db.prepare("SELECT id FROM teams WHERE normalized_name = ? AND team_type = 'club'");
const insertTeam = db.prepare(`
  INSERT INTO teams (canonical_name, normalized_name, team_type, country_id, fame_score)
  VALUES (?, ?, 'club', ?, 25)
`);
const updateTeamCountry = db.prepare("UPDATE teams SET country_id = COALESCE(country_id, ?) WHERE id = ?");
const insertTeamAlias = db.prepare(`
  INSERT OR IGNORE INTO team_aliases (team_id, alias, normalized_alias)
  VALUES (?, ?, ?)
`);
const findCompetition = db.prepare(`
  SELECT id FROM competitions WHERE canonical_name = ? AND country_id = ?
`);
const insertCompetition = db.prepare(`
  INSERT INTO competitions (canonical_name, country_id, competition_type, level)
  VALUES (?, ?, 'league', 1)
`);
const findSeason = db.prepare("SELECT id FROM seasons WHERE competition_id = ? AND label = ?");
const insertSeason = db.prepare(`
  INSERT INTO seasons (competition_id, label, start_date, end_date)
  VALUES (?, ?, ?, ?)
`);
const insertSpell = db.prepare(`
  INSERT OR IGNORE INTO player_team_spells (
    player_id, team_id, start_date, end_date, date_precision, spell_type,
    senior_appearance_confirmed, source_id, source_ref
  ) VALUES (?, ?, ?, ?, 'year', 'permanent', 1, 'api-football', ?)
`);
const upsertStats = db.prepare(`
  INSERT INTO player_season_stats (
    player_id, team_id, competition_id, season_id, appearances, starts,
    substitute_appearances, minutes, goals, assists, yellow_cards, red_cards,
    coverage_complete, source_id, retrieved_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'api-football', ?)
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
    coverage_complete = excluded.coverage_complete,
    retrieved_at = excluded.retrieved_at
`);

function providerCountryCode(name: string): string {
  return `API-${normalizeFootballText(name).replace(/\s+/g, "-").toUpperCase() || "UNKNOWN"}`;
}

function ensureCountry(name: string | null | undefined): number | null {
  if (!name) return null;
  const code = providerCountryCode(name);
  const existing = findCountry.get(code) as { id: number } | undefined;
  if (existing) return existing.id;
  return Number(insertCountry.run(code, name).lastInsertRowid);
}

function ensureTeam(externalId: number, name: string, countryId: number | null): number {
  const byExternal = findExternal.get("team", String(externalId)) as { entity_id: number } | undefined;
  if (byExternal) {
    updateTeamCountry.run(countryId, byExternal.entity_id);
    return byExternal.entity_id;
  }
  const normalized = normalizeFootballText(name);
  const existing = findTeam.get(normalized) as { id: number } | undefined;
  const id = existing?.id ?? Number(insertTeam.run(name, normalized, countryId).lastInsertRowid);
  updateTeamCountry.run(countryId, id);
  insertTeamAlias.run(id, name, normalized);
  addExternal.run("team", id, String(externalId));
  return id;
}

function ensureCompetition(
  externalId: number,
  name: string,
  countryId: number,
  seasonYear: number
): { competitionId: number; seasonId: number } {
  const byExternal = findExternal.get("competition", String(externalId)) as { entity_id: number } | undefined;
  let competitionId = byExternal?.entity_id;
  if (!competitionId) {
    const existing = findCompetition.get(name, countryId) as { id: number } | undefined;
    competitionId = existing?.id
      ?? Number(insertCompetition.run(name, countryId).lastInsertRowid);
    addExternal.run("competition", competitionId, String(externalId));
  }
  const label = `${seasonYear}-${String(seasonYear + 1).slice(-2)}`;
  const existingSeason = findSeason.get(competitionId, label) as { id: number } | undefined;
  const seasonId = existingSeason?.id ?? Number(insertSeason.run(
    competitionId,
    label,
    `${seasonYear}-07-01`,
    `${seasonYear + 1}-06-30`
  ).lastInsertRowid);
  return { competitionId, seasonId };
}

function parseHeight(value: string | null | undefined): number | null {
  const parsed = Number(value?.match(/\d+/)?.[0]);
  return Number.isFinite(parsed) && parsed >= 140 && parsed <= 220 ? parsed : null;
}

function importEntries(entries: ApiPlayer[]): number {
  const transaction = db.transaction((pageEntries: ApiPlayer[]) => {
    let statRows = 0;
    for (const entry of pageEntries) {
      const profile = entry.player;
      const external = findExternal.get("player", String(profile.id)) as { entity_id: number } | undefined;
      const normalized = normalizeFootballText(profile.name);
      const matchedByIdentity = findPlayer.get(
        normalized,
        profile.birth?.date ?? null,
        profile.birth?.date ?? null
      ) as { id: number } | undefined;
      const existingPlayerId = external?.entity_id ?? matchedByIdentity?.id;

      const countryId = ensureCountry(profile.nationality ?? profile.birth?.country);
      const position = entry.statistics.find((row) => row.games.position)?.games.position ?? null;
      const playerId = existingPlayerId ?? Number(insertPlayer.run(
        profile.name,
        profile.firstname,
        profile.lastname,
        normalized,
        profile.birth?.date ?? null,
        profile.birth?.date ? "day" : "unknown",
        countryId,
        parseHeight(profile.height),
        position,
        now,
        now
      ).lastInsertRowid);

      addExternal.run("player", playerId, String(profile.id));
      updatePlayer.run(
        profile.firstname,
        profile.lastname,
        profile.birth?.date ?? null,
        profile.birth?.date ?? null,
        countryId,
        parseHeight(profile.height),
        position,
        now,
        playerId
      );
      insertAlias.run(playerId, profile.name, normalized, "official");
      if (profile.lastname && normalizeFootballText(profile.lastname).length >= 3) {
        insertAlias.run(playerId, profile.lastname, normalizeFootballText(profile.lastname), "surname");
      }

      for (const stats of entry.statistics) {
        const competitionCountryId = ensureCountry(stats.league.country);
        if (!competitionCountryId) continue;
        const teamId = ensureTeam(stats.team.id, stats.team.name, competitionCountryId);
        const { competitionId, seasonId } = ensureCompetition(
          stats.league.id,
          stats.league.name,
          competitionCountryId,
          stats.league.season
        );
        insertSpell.run(
          playerId,
          teamId,
          `${stats.league.season}-01-01`,
          `${stats.league.season + 1}-12-31`,
          `${profile.id}:${stats.team.id}:${stats.league.season}`
        );
        upsertStats.run(
          playerId,
          teamId,
          competitionId,
          seasonId,
          stats.games.appearences,
          stats.games.lineups,
          stats.substitutes.in,
          stats.games.minutes,
          stats.goals.total,
          stats.goals.assists,
          stats.cards.yellow,
          stats.cards.red,
          now
        );
        statRows += 1;
      }
    }
    return statRows;
  });
  return transaction(entries);
}

async function main() {
  let page = 1;
  let players = 0;
  let rows = 0;
  let totalPages = 1;

  do {
    const url = new URL("https://v3.football.api-sports.io/players");
    url.searchParams.set("league", String(league));
    url.searchParams.set("season", String(season));
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers: { "x-apisports-key": key! } });
    if (!response.ok) throw new Error(`API-Football HTTP ${response.status}`);
    const payload = await response.json() as ApiResponse;
    if (Array.isArray(payload.errors) ? payload.errors.length : Object.keys(payload.errors ?? {}).length) {
      throw new Error(`API-Football: ${JSON.stringify(payload.errors)}`);
    }
    totalPages = Math.min(payload.paging.total, maxPages);
    players += payload.response.length;
    rows += importEntries(payload.response);
    console.log(`Page ${page}/${totalPages}: ${payload.response.length} joueurs`);
    page += 1;
  } while (page <= totalPages);

  const questions = rebuildFootballConnections(db);
  db.prepare(`
    INSERT INTO metadata (key, value) VALUES ('api_football_last_sync', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(now);
  console.log(`Synchronisation terminée: ${players} profils, ${rows} lignes de stats, ${questions} connexions.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
