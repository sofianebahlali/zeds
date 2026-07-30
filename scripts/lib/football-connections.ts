import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

type Db = Database.Database;

interface CareerRow {
  player_id: number;
  display_name: string;
  given_name: string | null;
  family_name: string | null;
  fame_score: number;
  team_id: number;
  team_name: string;
  team_type: "club" | "national";
  team_fame: number;
  start_date: string | null;
  end_date: string | null;
}

interface Bridge {
  playerId: number;
  playerName: string;
  playerFame: number;
  leftDetail: string | null;
  rightDetail: string | null;
}

interface Candidate {
  format: "club_club" | "club_country" | "initials";
  leftTeamId: number | null;
  rightTeamId: number | null;
  leftLabel: string;
  rightLabel: string;
  leftKind: "club" | "country" | "initial";
  rightKind: "club" | "country" | "initial";
  leftFame: number;
  rightFame: number;
  signature: string;
  answers: Bridge[];
}

export function normalizeFootballText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function detailFor(row: CareerRow): string | null {
  if (row.team_type === "national") return "Sélection nationale senior";
  if (!row.start_date && !row.end_date) return null;
  const from = row.start_date?.slice(0, 4) ?? "?";
  const to = row.end_date?.slice(0, 4) ?? "auj.";
  return `${from}–${to}`;
}

function stableId(signature: string): string {
  return `fc-${createHash("sha1").update(signature).digest("hex").slice(0, 12)}`;
}

function classify(candidate: Candidate): "easy" | "medium" | "hard" {
  const bestAnswer = Math.max(...candidate.answers.map((answer) => answer.playerFame));
  if (candidate.format === "initials") {
    const score = bestAnswer + Math.min(18, (candidate.answers.length - 1) * 4);
    return score >= 88 ? "easy" : score >= 72 ? "medium" : "hard";
  }

  const clueScore = (candidate.leftFame + candidate.rightFame) / 2;
  const weakestClue = Math.min(candidate.leftFame, candidate.rightFame);
  const alternatives = Math.min(20, (candidate.answers.length - 1) * 5);
  const score = bestAnswer + clueScore * 0.55 + alternatives;
  if (bestAnswer >= 82 && weakestClue >= 70 && score >= 125) return "easy";
  if (
    bestAnswer >= 65
    && score >= 105
    && (weakestClue >= 55 || (weakestClue >= 45 && candidate.answers.length >= 4))
  ) {
    return "medium";
  }
  return "hard";
}

function pushBridge(map: Map<string, Candidate>, candidate: Omit<Candidate, "answers">, bridge: Bridge) {
  const current = map.get(candidate.signature);
  if (current) {
    if (!current.answers.some((answer) => answer.playerId === bridge.playerId)) {
      current.answers.push(bridge);
    }
    return;
  }
  map.set(candidate.signature, { ...candidate, answers: [bridge] });
}

/**
 * Rebuild every playable connection from canonical career facts.
 *
 * This is intentionally deterministic: the runtime only selects from reviewed
 * facts and never has to invent or validate a relationship on the fly.
 */
export function rebuildFootballConnections(db: Db): number {
  const career = db.prepare(`
    SELECT
      p.id AS player_id,
      p.display_name,
      p.given_name,
      p.family_name,
      p.fame_score,
      t.id AS team_id,
      t.canonical_name AS team_name,
      t.team_type,
      t.fame_score AS team_fame,
      s.start_date,
      s.end_date
    FROM players p
    JOIN player_team_spells s ON s.player_id = p.id
    JOIN teams t ON t.id = s.team_id
    WHERE p.game_eligible = 1
      AND s.senior_appearance_confirmed = 1
      AND t.team_type IN ('club', 'national')
    ORDER BY p.id, t.team_type, s.start_date
  `).all() as CareerRow[];

  const byPlayer = new Map<number, CareerRow[]>();
  for (const row of career) {
    const rows = byPlayer.get(row.player_id) ?? [];
    rows.push(row);
    byPlayer.set(row.player_id, rows);
  }

  const candidates = new Map<string, Candidate>();

  for (const rows of byPlayer.values()) {
    const player = rows[0];
    const clubsById = new Map<number, CareerRow>();
    const nationsById = new Map<number, CareerRow>();

    for (const row of rows) {
      const target = row.team_type === "club" ? clubsById : nationsById;
      if (!target.has(row.team_id)) target.set(row.team_id, row);
    }

    const clubs = Array.from(clubsById.values());
    const nations = Array.from(nationsById.values());

    for (let i = 0; i < clubs.length; i++) {
      for (let j = i + 1; j < clubs.length; j++) {
        const ordered = [clubs[i], clubs[j]].sort((a, b) => a.team_id - b.team_id);
        const [left, right] = ordered;
        if (Math.min(left.team_fame, right.team_fame) < 15 || player.fame_score < 42) continue;
        const signature = `club_club:${left.team_id}:${right.team_id}`;
        pushBridge(candidates, {
          format: "club_club",
          leftTeamId: left.team_id,
          rightTeamId: right.team_id,
          leftLabel: left.team_name,
          rightLabel: right.team_name,
          leftKind: "club",
          rightKind: "club",
          leftFame: left.team_fame,
          rightFame: right.team_fame,
          signature,
        }, {
          playerId: player.player_id,
          playerName: player.display_name,
          playerFame: player.fame_score,
          leftDetail: detailFor(left),
          rightDetail: detailFor(right),
        });
      }
    }

    for (const club of clubs) {
      for (const nation of nations) {
        if (club.team_fame < 18 || player.fame_score < 48) continue;
        const signature = `club_country:${club.team_id}:${nation.team_id}`;
        pushBridge(candidates, {
          format: "club_country",
          leftTeamId: club.team_id,
          rightTeamId: nation.team_id,
          leftLabel: club.team_name,
          rightLabel: nation.team_name,
          leftKind: "club",
          rightKind: "country",
          leftFame: club.team_fame,
          rightFame: nation.team_fame,
          signature,
        }, {
          playerId: player.player_id,
          playerName: player.display_name,
          playerFame: player.fame_score,
          leftDetail: detailFor(club),
          rightDetail: detailFor(nation),
        });
      }
    }

    if (player.fame_score >= 65 && player.given_name && player.family_name) {
      const left = normalizeFootballText(player.given_name).charAt(0).toUpperCase();
      const right = normalizeFootballText(player.family_name).charAt(0).toUpperCase();
      if (left && right) {
        const signature = `initials:${left}:${right}`;
        pushBridge(candidates, {
          format: "initials",
          leftTeamId: null,
          rightTeamId: null,
          leftLabel: left,
          rightLabel: right,
          leftKind: "initial",
          rightKind: "initial",
          leftFame: 50,
          rightFame: 50,
          signature,
        }, {
          playerId: player.player_id,
          playerName: player.display_name,
          playerFame: player.fame_score,
          leftDetail: null,
          rightDetail: null,
        });
      }
    }
  }

  const insertQuestion = db.prepare(`
    INSERT INTO football_connection_questions (
      id, format, left_team_id, right_team_id, left_label, right_label,
      left_kind, right_kind, difficulty, time_limit, points, answer_count,
      clue_signature
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAnswer = db.prepare(`
    INSERT INTO football_connection_answers (
      question_id, player_id, left_detail, right_detail
    ) VALUES (?, ?, ?, ?)
  `);

  const rebuild = db.transaction(() => {
    db.prepare("DELETE FROM football_connection_answers").run();
    db.prepare("DELETE FROM football_connection_questions").run();

    const ordered = Array.from(candidates.values()).sort((a, b) =>
      a.signature.localeCompare(b.signature)
    );
    for (const candidate of ordered) {
      const difficulty = classify(candidate);
      const timeLimit = difficulty === "easy" ? 12 : difficulty === "medium" ? 15 : 18;
      const points = difficulty === "easy" ? 100 : difficulty === "medium" ? 125 : 150;
      const id = stableId(candidate.signature);
      insertQuestion.run(
        id,
        candidate.format,
        candidate.leftTeamId,
        candidate.rightTeamId,
        candidate.leftLabel,
        candidate.rightLabel,
        candidate.leftKind,
        candidate.rightKind,
        difficulty,
        timeLimit,
        points,
        candidate.answers.length,
        candidate.signature
      );
      for (const answer of candidate.answers.sort((a, b) => b.playerFame - a.playerFame)) {
        insertAnswer.run(id, answer.playerId, answer.leftDetail, answer.rightDetail);
      }
    }
  });

  rebuild();
  return candidates.size;
}
