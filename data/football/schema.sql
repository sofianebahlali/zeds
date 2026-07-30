PRAGMA foreign_keys = ON;

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  license TEXT,
  retrieved_at TEXT NOT NULL
);

CREATE TABLE countries (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  flag TEXT
);

CREATE TABLE teams (
  id INTEGER PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  team_type TEXT NOT NULL CHECK (team_type IN ('club', 'national', 'reserve', 'youth')),
  country_id INTEGER REFERENCES countries(id),
  parent_team_id INTEGER REFERENCES teams(id),
  fame_score INTEGER NOT NULL DEFAULT 0 CHECK (fame_score BETWEEN 0 AND 100),
  UNIQUE(normalized_name, team_type)
);

CREATE TABLE team_aliases (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  language TEXT,
  PRIMARY KEY (team_id, normalized_alias)
);

CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  given_name TEXT,
  family_name TEXT,
  normalized_name TEXT NOT NULL,
  birth_date TEXT,
  birth_date_precision TEXT NOT NULL DEFAULT 'unknown'
    CHECK (birth_date_precision IN ('day', 'month', 'year', 'unknown')),
  birth_country_id INTEGER REFERENCES countries(id),
  sporting_country_id INTEGER REFERENCES countries(id),
  gender TEXT NOT NULL DEFAULT 'male',
  primary_position TEXT,
  height_cm INTEGER,
  preferred_foot TEXT,
  fame_score INTEGER NOT NULL DEFAULT 0 CHECK (fame_score BETWEEN 0 AND 100),
  game_eligible INTEGER NOT NULL DEFAULT 0 CHECK (game_eligible IN (0, 1)),
  profile_quality TEXT NOT NULL DEFAULT 'partial'
    CHECK (profile_quality IN ('partial', 'verified')),
  career_quality TEXT NOT NULL DEFAULT 'partial'
    CHECK (career_quality IN ('partial', 'verified')),
  stats_quality TEXT NOT NULL DEFAULT 'missing'
    CHECK (stats_quality IN ('missing', 'partial', 'verified')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_players_normalized_name ON players(normalized_name);
CREATE INDEX idx_players_game_eligible ON players(game_eligible, fame_score DESC);

CREATE TABLE player_aliases (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  language TEXT,
  alias_type TEXT NOT NULL DEFAULT 'common'
    CHECK (alias_type IN ('official', 'common', 'surname', 'nickname', 'transliteration')),
  PRIMARY KEY (player_id, normalized_alias)
);

CREATE INDEX idx_player_aliases_normalized ON player_aliases(normalized_alias);

CREATE TABLE competitions (
  id INTEGER PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  country_id INTEGER REFERENCES countries(id),
  competition_type TEXT NOT NULL
    CHECK (competition_type IN ('league', 'cup', 'continental', 'international')),
  gender TEXT NOT NULL DEFAULT 'male',
  level INTEGER,
  UNIQUE(canonical_name, country_id)
);

CREATE TABLE seasons (
  id INTEGER PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  label TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  UNIQUE(competition_id, label)
);

CREATE TABLE player_team_spells (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  start_date TEXT,
  end_date TEXT,
  date_precision TEXT NOT NULL DEFAULT 'year'
    CHECK (date_precision IN ('day', 'month', 'year', 'unknown')),
  spell_type TEXT NOT NULL DEFAULT 'permanent'
    CHECK (spell_type IN ('permanent', 'loan', 'academy', 'international')),
  parent_team_id INTEGER REFERENCES teams(id),
  senior_appearance_confirmed INTEGER NOT NULL DEFAULT 1
    CHECK (senior_appearance_confirmed IN (0, 1)),
  source_id TEXT REFERENCES data_sources(id),
  source_ref TEXT,
  UNIQUE(player_id, team_id, start_date, end_date, spell_type)
);

CREATE INDEX idx_spells_player ON player_team_spells(player_id);
CREATE INDEX idx_spells_team ON player_team_spells(team_id);

CREATE TABLE player_season_stats (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  competition_id INTEGER NOT NULL REFERENCES competitions(id),
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  appearances INTEGER,
  starts INTEGER,
  substitute_appearances INTEGER,
  minutes INTEGER,
  goals INTEGER,
  assists INTEGER,
  yellow_cards INTEGER,
  red_cards INTEGER,
  clean_sheets INTEGER,
  coverage_complete INTEGER NOT NULL DEFAULT 0 CHECK (coverage_complete IN (0, 1)),
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  retrieved_at TEXT NOT NULL,
  UNIQUE(player_id, team_id, competition_id, season_id, source_id)
);

CREATE INDEX idx_season_stats_player_team ON player_season_stats(player_id, team_id);

-- Some open sources expose a reliable career total without its complete
-- season-by-season breakdown. Keep that snapshot separate so it never gets
-- silently mixed with granular rows.
CREATE TABLE player_team_stat_snapshots (
  id INTEGER PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  scope TEXT NOT NULL CHECK (scope IN ('domestic_league', 'all_official')),
  appearances INTEGER,
  goals INTEGER,
  assists INTEGER,
  through_date TEXT,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  retrieved_at TEXT NOT NULL,
  UNIQUE(player_id, team_id, scope, source_id)
);

CREATE TABLE external_ids (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'team', 'competition')),
  entity_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  PRIMARY KEY (entity_type, provider, external_id),
  UNIQUE(entity_type, entity_id, provider)
);

CREATE TABLE football_connection_questions (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL CHECK (format IN ('club_club', 'club_country', 'initials')),
  left_team_id INTEGER REFERENCES teams(id),
  right_team_id INTEGER REFERENCES teams(id),
  left_label TEXT NOT NULL,
  right_label TEXT NOT NULL,
  left_kind TEXT NOT NULL CHECK (left_kind IN ('club', 'country', 'initial')),
  right_kind TEXT NOT NULL CHECK (right_kind IN ('club', 'country', 'initial')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  time_limit INTEGER NOT NULL,
  points INTEGER NOT NULL,
  answer_count INTEGER NOT NULL,
  clue_signature TEXT NOT NULL UNIQUE
);

CREATE INDEX idx_connection_format_difficulty
  ON football_connection_questions(format, difficulty);

CREATE TABLE football_connection_answers (
  question_id TEXT NOT NULL REFERENCES football_connection_questions(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  left_detail TEXT,
  right_detail TEXT,
  PRIMARY KEY (question_id, player_id)
);

CREATE VIEW v_player_club_totals AS
WITH seasonal AS (
  SELECT
    player_id,
    team_id,
    SUM(COALESCE(appearances, 0)) AS appearances,
    SUM(COALESCE(goals, 0)) AS goals,
    SUM(COALESCE(assists, 0)) AS assists,
    SUM(COALESCE(minutes, 0)) AS minutes,
    MIN(coverage_complete) AS coverage_complete
  FROM player_season_stats
  GROUP BY player_id, team_id
),
snapshots AS (
  SELECT s.player_id, s.team_id, s.appearances, s.goals, s.assists
  FROM player_team_stat_snapshots s
  JOIN (
    SELECT player_id, team_id, MAX(
      CASE scope WHEN 'all_official' THEN 2 ELSE 1 END
    ) AS preferred_scope
    FROM player_team_stat_snapshots
    GROUP BY player_id, team_id
  ) chosen
    ON chosen.player_id = s.player_id
   AND chosen.team_id = s.team_id
   AND chosen.preferred_scope =
      CASE s.scope WHEN 'all_official' THEN 2 ELSE 1 END
)
SELECT
  p.id AS player_id,
  p.display_name,
  t.id AS team_id,
  t.canonical_name AS team_name,
  COALESCE(seasonal.appearances, snapshots.appearances) AS appearances,
  COALESCE(seasonal.goals, snapshots.goals) AS goals,
  COALESCE(seasonal.assists, snapshots.assists) AS assists,
  seasonal.minutes,
  CASE
    WHEN seasonal.player_id IS NOT NULL THEN 'season_sum'
    ELSE 'provider_snapshot'
  END AS calculation_method,
  CASE
    WHEN seasonal.player_id IS NOT NULL THEN seasonal.coverage_complete
    ELSE 0
  END AS coverage_complete
FROM players p
JOIN player_team_spells spell ON spell.player_id = p.id
JOIN teams t ON t.id = spell.team_id AND t.team_type = 'club'
LEFT JOIN seasonal ON seasonal.player_id = p.id AND seasonal.team_id = t.id
LEFT JOIN snapshots ON snapshots.player_id = p.id AND snapshots.team_id = t.id
GROUP BY p.id, t.id;

CREATE VIEW v_player_career_totals AS
SELECT
  player_id,
  display_name,
  SUM(COALESCE(appearances, 0)) AS appearances,
  SUM(COALESCE(goals, 0)) AS goals,
  SUM(COALESCE(assists, 0)) AS assists,
  SUM(COALESCE(minutes, 0)) AS minutes,
  COUNT(*) AS clubs,
  MIN(coverage_complete) AS coverage_complete
FROM v_player_club_totals
GROUP BY player_id, display_name;
