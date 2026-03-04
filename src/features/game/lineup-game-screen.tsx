"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Check, X, Trophy } from "lucide-react";
import { Button, Input, TimerProgress } from "@/components/ui";
import { useGameStore, useRoomStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { LineupQuestion, LineupPlayer } from "@/types";

// Sort value for lateral position: L-positions left, center middle, R-positions right
function getPositionSide(pos: string): number {
  if (pos.startsWith("L")) return 0; // Left side (LB, LW, LM, LWB)
  if (pos.startsWith("R")) return 2; // Right side (RB, RW, RM, RWB)
  return 1; // Center (CB, CM, CDM, CAM, CF, ST)
}

// Map position codes to row placement in a formation layout
function getFormationRows(formation: string, players: LineupPlayer[]): LineupPlayer[][] {
  // Parse formation like "4-2-3-1" or "4-3-3" or "3-5-2"
  const parts = formation.split("-").map(Number);
  const rows: LineupPlayer[][] = [];

  // GK always first row
  const gk = players.filter((p) => p.pos === "GK");
  const outfield = players.filter((p) => p.pos !== "GK");

  rows.push(gk);

  let idx = 0;
  for (const count of parts) {
    const row = outfield.slice(idx, idx + count);
    // Sort within row: L-positions left, center middle, R-positions right
    row.sort((a, b) => getPositionSide(a.pos) - getPositionSide(b.pos));
    rows.push(row);
    idx += count;
  }

  // If we have leftover players, add them to last row
  if (idx < outfield.length) {
    rows[rows.length - 1].push(...outfield.slice(idx));
  }

  return rows;
}

function PlayerSlot({
  player,
  found,
  foundByMe,
  globalIndex,
}: {
  player: LineupPlayer;
  found: boolean;
  foundByMe: boolean;
  globalIndex: number;
}) {
  return (
    <motion.div
      className="flex flex-col items-center gap-0.5"
      initial={false}
      animate={found ? { scale: [1, 1.2, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300",
          found
            ? foundByMe
              ? "bg-lime-500 border-lime-400 text-white"
              : "bg-blue-500 border-blue-400 text-white"
            : "bg-surface-700/60 border-surface-600 text-surface-400"
        )}
      >
        {found ? player.num : "?"}
      </div>
      <span
        className={cn(
          "text-[9px] font-medium text-center leading-tight max-w-[50px] truncate transition-all duration-300",
          found
            ? foundByMe
              ? "text-lime-400"
              : "text-blue-400"
            : "text-surface-500"
        )}
      >
        {found ? player.name : "???"}
      </span>
    </motion.div>
  );
}

function TeamFormation({
  teamName,
  flag,
  formation,
  players,
  foundPlayers,
  globalOffset,
  myPlayerId,
  isReversed,
}: {
  teamName: string;
  flag: string;
  formation: string;
  players: LineupPlayer[];
  foundPlayers: { teamSide: 1 | 2; playerIndex: number; displayName: string; foundByPlayerId: string }[];
  globalOffset: number;
  myPlayerId: string;
  isReversed: boolean;
}) {
  const rows = getFormationRows(formation, players);
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
            {row.map((player) => {
              // Find global index of this player in the team
              const playerIdx = players.indexOf(player);
              const isFound = foundPlayers.some(
                (fp) =>
                  fp.playerIndex === playerIdx &&
                  ((globalOffset === 0 && fp.teamSide === 1) ||
                    (globalOffset > 0 && fp.teamSide === 2))
              );
              const foundByMe = foundPlayers.some(
                (fp) =>
                  fp.playerIndex === playerIdx &&
                  ((globalOffset === 0 && fp.teamSide === 1) ||
                    (globalOffset > 0 && fp.teamSide === 2)) &&
                  fp.foundByPlayerId === myPlayerId
              );

              return (
                <PlayerSlot
                  key={playerIdx}
                  player={player}
                  found={isFound}
                  foundByMe={foundByMe}
                  globalIndex={globalOffset + playerIdx}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineupGameScreen() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const lineupFoundPlayers = useGameStore((s) => s.lineupFoundPlayers);
  const lineupMyFoundCount = useGameStore((s) => s.lineupMyFoundCount);
  const lineupLastGuessCorrect = useGameStore((s) => s.lineupLastGuessCorrect);
  const players = useRoomStore((s) => s.players);
  const { submitLineupGuess } = useSocket();
  const { socket } = useSocket();
  const myPlayerId = `player_${socket.id}`;

  const [guess, setGuess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!currentQuestion || currentQuestion.type !== "lineup") return null;

  const q = currentQuestion as LineupQuestion;
  const { match } = q;
  const totalPlayers = match.team1.players.length + match.team2.players.length;
  const totalTime = q.timeLimit;

  const handleSubmitGuess = useCallback(() => {
    const trimmed = guess.trim();
    if (!trimmed || timeRemaining <= 0) return;

    submitLineupGuess(trimmed);
    setGuess("");
    inputRef.current?.focus();

    // Clear previous feedback timeout
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    // Auto-clear feedback after 1.5s
    feedbackTimeoutRef.current = setTimeout(() => {
      useGameStore.getState().setLineupLastGuessCorrect(null);
    }, 1500);
  }, [guess, timeRemaining, submitLineupGuess]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-3 py-2 gap-2"
    >
      {/* Match header */}
      <div className="text-center space-y-1">
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
        <div className="text-[10px] text-surface-500">{match.date}</div>
      </div>

      {/* Timer */}
      <TimerProgress timeRemaining={timeRemaining} totalTime={totalTime} />

      {/* Score counter */}
      <div className="flex items-center justify-center gap-2">
        <Trophy className="w-3.5 h-3.5 text-lime-400" />
        <span className="text-sm font-semibold text-surface-200">
          <span className="text-lime-400">{lineupMyFoundCount}</span>
          <span className="text-surface-500">/{totalPlayers}</span>
        </span>
        <span className="text-[10px] text-surface-500">trouvés par toi</span>
      </div>

      {/* Formation display — two teams */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="bg-gradient-to-b from-green-900/30 to-green-800/20 rounded-xl border border-green-800/30 p-3 space-y-4">
          {/* Team 1 — GK at bottom */}
          <TeamFormation
            teamName={match.team1.name}
            flag={match.team1.flag}
            formation={match.team1.formation}
            players={match.team1.players}
            foundPlayers={lineupFoundPlayers}
            globalOffset={0}
            myPlayerId={myPlayerId}
            isReversed={false}
          />

          {/* Divider */}
          <div className="border-t border-dashed border-green-700/50 my-1" />

          {/* Team 2 — GK at bottom (reversed) */}
          <TeamFormation
            teamName={match.team2.name}
            flag={match.team2.flag}
            formation={match.team2.formation}
            players={match.team2.players}
            foundPlayers={lineupFoundPlayers}
            globalOffset={match.team1.players.length}
            myPlayerId={myPlayerId}
            isReversed={true}
          />
        </div>
      </div>

      {/* Guess input */}
      <div className="sticky bottom-0 pb-safe-bottom">
        {/* Feedback */}
        <AnimatePresence>
          {lineupLastGuessCorrect !== null && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "flex items-center justify-center gap-1.5 py-1 text-xs font-medium mb-1",
                lineupLastGuessCorrect ? "text-lime-400" : "text-red-400"
              )}
            >
              {lineupLastGuessCorrect ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Bien joue !
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5" /> Pas trouve...
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitGuess();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Nom d'un joueur..."
            className="flex-1"
            autoComplete="off"
            autoFocus
            disabled={timeRemaining <= 0}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!guess.trim() || timeRemaining <= 0}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
