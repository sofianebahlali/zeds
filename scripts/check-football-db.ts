import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";

const dbPath = path.resolve(__dirname, "../data/football.db");
if (!fs.existsSync(dbPath)) throw new Error("data/football.db est absent.");

const db = new Database(dbPath, { readonly: true });
const scalar = (sql: string, ...params: unknown[]): number =>
  (db.prepare(sql).pluck().get(...params) as number) ?? 0;
const failures: string[] = [];
const warnings: string[] = [];

const foreignKeys = db.pragma("foreign_key_check") as unknown[];
if (foreignKeys.length) failures.push(`${foreignKeys.length} violation(s) de clé étrangère`);

const checks: [string, string][] = [
  ["connexions sans réponse", `
    SELECT COUNT(*) FROM football_connection_questions q
    LEFT JOIN football_connection_answers a ON a.question_id = q.id
    WHERE a.question_id IS NULL
  `],
  ["questions pays/pays interdites", `
    SELECT COUNT(*) FROM football_connection_questions
    WHERE left_kind = 'country' AND right_kind = 'country'
  `],
  ["réponses sans parcours confirmé", `
    SELECT COUNT(*) FROM football_connection_answers a
    WHERE NOT EXISTS (
      SELECT 1 FROM player_team_spells s
      WHERE s.player_id = a.player_id AND s.senior_appearance_confirmed = 1
    )
  `],
  ["statistiques négatives", `
    SELECT COUNT(*) FROM player_season_stats
    WHERE appearances < 0 OR goals < 0 OR assists < 0 OR minutes < 0
  `],
  ["joueurs jouables sans alias", `
    SELECT COUNT(*) FROM players p
    WHERE p.game_eligible = 1
      AND NOT EXISTS (SELECT 1 FROM player_aliases a WHERE a.player_id = p.id)
  `],
];
for (const [label, sql] of checks) {
  const count = scalar(sql);
  if (count) failures.push(`${label}: ${count}`);
}

const examples = [
  ["Manchester United", "Real Madrid", "Cristiano Ronaldo"],
  ["Manchester United", "Allemagne", "Bastian Schweinsteiger"],
] as const;
for (const [left, right, player] of examples) {
  const exists = scalar(`
    SELECT COUNT(*)
    FROM football_connection_questions q
    JOIN football_connection_answers a ON a.question_id = q.id
    JOIN players p ON p.id = a.player_id
    WHERE ((q.left_label = ? AND q.right_label = ?) OR (q.left_label = ? AND q.right_label = ?))
      AND p.display_name = ?
  `, left, right, right, left, player);
  if (!exists) failures.push(`exemple absent: ${left} ↔ ${right} = ${player}`);
}
const initials = db.prepare(`
  SELECT COUNT(*) AS count
  FROM football_connection_questions q
  JOIN football_connection_answers a ON a.question_id = q.id
  JOIN players p ON p.id = a.player_id
  WHERE q.format = 'initials' AND q.left_label = 'L' AND q.right_label = 'M'
    AND p.display_name = 'Lionel Messi'
`).pluck().get() as number;
if (!initials) failures.push("exemple absent: L M = Lionel Messi");

const missingBirthDates = scalar("SELECT COUNT(*) FROM players WHERE birth_date IS NULL");
const missingStats = scalar(`
  SELECT COUNT(*) FROM players p
  WHERE NOT EXISTS (SELECT 1 FROM v_player_club_totals v WHERE v.player_id = p.id)
`);
if (missingBirthDates) warnings.push(`${missingBirthDates} joueur(s) sans date de naissance`);
if (missingStats) warnings.push(`${missingStats} joueur(s) sans total club`);

const summary = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM players) AS players,
    (SELECT COUNT(*) FROM players WHERE game_eligible = 1) AS eligiblePlayers,
    (SELECT COUNT(*) FROM external_ids WHERE entity_type = 'player' AND provider = 'transfermarkt') AS transfermarktPlayers,
    (SELECT COUNT(*) FROM players WHERE birth_date IS NOT NULL) AS playersWithBirthDate,
    (SELECT COUNT(*) FROM teams WHERE team_type = 'club') AS clubs,
    (SELECT COUNT(*) FROM player_team_spells) AS spells,
    (SELECT COUNT(*) FROM player_season_stats) AS stats,
    (SELECT COUNT(*) FROM football_connection_questions) AS questions
`).get() as Record<string, number>;
if (summary.players < 10_000) failures.push(`couverture joueurs insuffisante: ${summary.players}`);
if (summary.transfermarktPlayers < 10_000) {
  failures.push(`identifiants Transfermarkt insuffisants: ${summary.transfermarktPlayers}`);
}
if (summary.eligiblePlayers < 1_000) {
  failures.push(`joueurs jouables insuffisants: ${summary.eligiblePlayers}`);
}
if (summary.stats < 100_000) failures.push(`couverture statistique insuffisante: ${summary.stats}`);
if (summary.questions < 10_000) failures.push(`banque de connexions insuffisante: ${summary.questions}`);
if (summary.playersWithBirthDate / Math.max(1, summary.players) < 0.95) {
  failures.push("moins de 95 % des joueurs ont une date de naissance");
}
for (const competitionId of ["GB1", "ES1", "IT1", "L1", "FR1"]) {
  const exists = scalar(`
    SELECT COUNT(*) FROM external_ids
    WHERE entity_type = 'competition' AND provider = 'transfermarkt' AND external_id = ?
  `, competitionId);
  if (!exists) failures.push(`grand championnat absent: ${competitionId}`);
}
const distribution = db.prepare(`
  SELECT format, difficulty, COUNT(*) AS count
  FROM football_connection_questions
  GROUP BY format, difficulty
  ORDER BY format, difficulty
`).all();

console.log("Base football:", summary);
console.table(distribution);
for (const warning of warnings) console.warn(`AVERTISSEMENT: ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`ERREUR: ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Contrôles bloquants: OK");
}
db.close();
