"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Eye, ChevronRight, Trophy } from "lucide-react";
import { Button, Avatar } from "@/components/ui";
import { useGameStore, useRoomStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { LineupQuestion, LineupPlayer } from "@/types";

const REVEAL_DURATION = 30;

// Same position sort as lineup-game-screen
function getPositionSide(pos: string): number {
  if (pos.startsWith("L")) return 0;
  if (pos.startsWith("R")) return 2;
  return 1;
}

function getFormationRows(formation: string, players: LineupPlayer[], mirrorSides = false): LineupPlayer[][] {
  const parts = formation.split("-").map(Number);
  const rows: LineupPlayer[][] = [];
  const gk = players.filter((p) => p.pos === "GK");
  const outfield = players.filter((p) => p.pos !== "GK");
  rows.push(gk);
  let idx = 0;
  for (const count of parts) {
    const row = outfield.slice(idx, idx + count);
    row.sort((a, b) =>
      mirrorSides
        ? getPositionSide(b.pos) - getPositionSide(a.pos)
        : getPositionSide(a.pos) - getPositionSide(b.pos)
    );
    rows.push(row);
    idx += count;
  }
  if (idx < outfield.length) {
    rows[rows.length - 1].push(...outfield.slice(idx));
  }
  return rows;
}

function RevealPlayerSlot({ player }: { player: LineupPlayer }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-0.5"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, type: "spring" }}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 bg-surface-100 border-surface-200 text-surface-900">
        {player.num}
      </div>
      <span className="text-[9px] font-medium text-center leading-tight max-w-[54px] truncate text-surface-200">
        {player.name}
      </span>
    </motion.div>
  );
}

function RevealTeamFormation({
  teamName,
  flag,
  formation,
  players,
  isReversed,
}: {
  teamName: string;
  flag: string;
  formation: string;
  players: LineupPlayer[];
  isReversed: boolean;
}) {
  // Top team (not reversed) faces down → mirror L/R sides
  const rows = getFormationRows(formation, players, !isReversed);
  const orderedRows = isReversed ? [...rows].reverse() : rows;

  return (
    <div className="flex flex-col gap-1">
      <div className="text-center text-xs font-semibold text-surface-200 mb-1">
        {flag} {teamName}
        <span className="text-surface-500 ml-1 font-normal">({formation})</span>
      </div>
      <div className="flex flex-col gap-2">
        {orderedRows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex justify-center gap-3">
            {row.map((player, pIdx) => (
              <RevealPlayerSlot key={pIdx} player={player} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineupRevealScreen() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const lineupRevealMatch = useGameStore((s) => s.lineupRevealMatch);
  const lineupRevealScores = useGameStore((s) => s.lineupRevealScores);
  const players = useRoomStore((s) => s.players);
  const isHost = usePlayerStore((s) => s.isHost);
  const { skipLineupReveal } = useSocket();
  const [timeLeft, setTimeLeft] = useState(REVEAL_DURATION);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSkip = useCallback(() => {
    skipLineupReveal();
  }, [skipLineupReveal]);

  if (!currentQuestion || currentQuestion.type !== "lineup") return null;

  // Use the full match data from the reveal event (with player names)
  // Fall back to currentQuestion match (which has names hidden) if reveal data not yet received
  const match = lineupRevealMatch ?? (currentQuestion as LineupQuestion).match;

  // Sort scores by foundCount descending
  const sortedScores = [...(lineupRevealScores || [])].sort(
    (a, b) => b.foundCount - a.foundCount
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-3 py-2 gap-2"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-surface-300">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-display font-bold">Les compos</span>
        </div>
        <div className="text-[11px] text-surface-400 font-medium uppercase tracking-wide">
          {match.competition}
        </div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm font-bold text-surface-100">
            {match.team1.flag} {match.team1.name}
          </span>
          <span className="text-lg font-display font-bold text-brand-400">
            {match.score}
          </span>
          <span className="text-sm font-bold text-surface-100">
            {match.team2.name} {match.team2.flag}
          </span>
        </div>
      </div>

      {/* Player scores */}
      {sortedScores.length > 0 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {sortedScores.map((s, idx) => {
            const player = players.find((p) => p.id === s.playerId);
            if (!player) return null;
            return (
              <div
                key={s.playerId}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs",
                  "bg-surface-900 border border-surface-800",
                  idx === 0 && s.foundCount > 0 && "border-accent-500/50"
                )}
              >
                {idx === 0 && s.foundCount > 0 && (
                  <Trophy className="w-3 h-3 text-accent-400" />
                )}
                <Avatar emoji={player.avatar} size="sm" />
                <span className="text-surface-400">{player.name}</span>
                <span className="font-bold text-lime-400">{s.foundCount}</span>
                <span className="text-surface-600">/22</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Formation display */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="bg-gradient-to-b from-green-900/30 to-green-800/20 rounded-xl border border-green-800/30 p-3 space-y-4">
          <RevealTeamFormation
            teamName={match.team1.name}
            flag={match.team1.flag}
            formation={match.team1.formation}
            players={match.team1.players}
            isReversed={false}
          />

          <div className="border-t border-dashed border-green-700/50 my-1" />

          <RevealTeamFormation
            teamName={match.team2.name}
            flag={match.team2.flag}
            formation={match.team2.formation}
            players={match.team2.players}
            isReversed={true}
          />
        </div>
      </div>

      {/* Footer: timer + host skip button */}
      <div className="flex items-center justify-between pb-safe-bottom">
        <span className="text-xs text-surface-500">
          Suite dans {timeLeft}s...
        </span>
        {isHost && (
          <Button size="sm" onClick={handleSkip} className="gap-1.5">
            Suivant <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
