"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Lightbulb, Check, Trophy, Flag } from "lucide-react";
import { Button, Input, TimerProgress } from "@/components/ui";
import { useGameStore, useRoomStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { PokemonStatsQuestion, PokestatsHintData } from "@/types";

// ==========================================
// RADAR CHART COMPONENT
// ==========================================

const STAT_LABELS = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];
const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
const MAX_STAT = 200; // Visual scale cap
const CX = 100;
const CY = 100;
const RADIUS = 75;

function getPoint(index: number, value: number, maxVal: number = MAX_STAT) {
  const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
  const scale = Math.min(value / maxVal, 1);
  return {
    x: CX + scale * RADIUS * Math.cos(angle),
    y: CY + scale * RADIUS * Math.sin(angle),
  };
}

function RadarChart({ stats }: { stats: PokemonStatsQuestion["stats"] }) {
  const values = STAT_KEYS.map((k) => stats[k]);

  // Grid lines (hexagons at 25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[220px] mx-auto">
      {/* Background hexagonal grid */}
      {gridLevels.map((level) => {
        const points = Array.from({ length: 6 }, (_, i) => {
          const p = getPoint(i, level * MAX_STAT);
          return `${p.x},${p.y}`;
        }).join(" ");
        return (
          <polygon
            key={level}
            points={points}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Axis lines */}
      {Array.from({ length: 6 }, (_, i) => {
        const p = getPoint(i, MAX_STAT);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Data polygon */}
      <motion.polygon
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        points={values
          .map((v, i) => {
            const p = getPoint(i, v);
            return `${p.x},${p.y}`;
          })
          .join(" ")}
        fill="rgba(250, 204, 21, 0.25)"
        stroke="rgba(250, 204, 21, 0.8)"
        strokeWidth={2}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />

      {/* Stat labels */}
      {STAT_LABELS.map((label, i) => {
        const p = getPoint(i, MAX_STAT + 30);
        return (
          <text
            key={label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-surface-400 text-[8px] font-semibold"
          >
            {label}
          </text>
        );
      })}

      {/* Stat value labels */}
      {values.map((v, i) => {
        const p = getPoint(i, MAX_STAT + 15);
        return (
          <text
            key={`val-${i}`}
            x={p.x}
            y={p.y + 8}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-yellow-400 text-[7px] font-bold"
          >
            {v}
          </text>
        );
      })}
    </svg>
  );
}

// ==========================================
// HINT DISPLAY COMPONENT
// ==========================================

const HINT_LABELS: Record<PokestatsHintData["hintType"], string> = {
  type1: "Type",
  type2: "Type 2",
  generation: "Génération",
  ability: "Talent",
};

const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-gray-400",
  Fire: "bg-orange-500",
  Water: "bg-blue-500",
  Electric: "bg-yellow-400",
  Grass: "bg-green-500",
  Ice: "bg-cyan-300",
  Fighting: "bg-red-700",
  Poison: "bg-purple-500",
  Ground: "bg-amber-600",
  Flying: "bg-indigo-300",
  Psychic: "bg-pink-500",
  Bug: "bg-lime-500",
  Rock: "bg-yellow-700",
  Ghost: "bg-purple-700",
  Dragon: "bg-indigo-600",
  Dark: "bg-stone-700",
  Steel: "bg-slate-400",
  Fairy: "bg-pink-300",
};

function HintBadge({ hint }: { hint: PokestatsHintData }) {
  const isType = hint.hintType === "type1" || hint.hintType === "type2";
  const colorClass = isType ? TYPE_COLORS[hint.value] || "bg-surface-600" : "bg-surface-700";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="flex items-center gap-1.5"
    >
      <span className="text-[10px] text-surface-500 font-medium">
        {HINT_LABELS[hint.hintType]}:
      </span>
      <span
        className={cn(
          "text-[11px] font-bold px-2 py-0.5 rounded-full text-white",
          colorClass
        )}
      >
        {hint.hintType === "generation" ? `Gen ${hint.valueFr}` : hint.valueFr}
      </span>
    </motion.div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export function PokestatsGameScreen() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const pokestatsHints = useGameStore((s) => s.pokestatsHints);
  const pokestatsFound = useGameStore((s) => s.pokestatsFound);
  const pokestatsMyPoints = useGameStore((s) => s.pokestatsMyPoints);
  const pokestatsFoundPlayers = useGameStore((s) => s.pokestatsFoundPlayers);
  const pokestatsAbandoned = useGameStore((s) => s.pokestatsAbandoned);
  const pokestatsAbandonData = useGameStore((s) => s.pokestatsAbandonData);
  const players = useRoomStore((s) => s.players);
  const myPlayerId = usePlayerStore((s) => s.playerId);
  const { submitPokestatsGuess, usePokestatsHint, abandonPokestats } = useSocket();

  const [guess, setGuess] = useState("");
  const [lastWrong, setLastWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  if (!currentQuestion || currentQuestion.type !== "pokestats") return null;

  const q = currentQuestion as PokemonStatsQuestion;
  const totalTime = q.timeLimit;
  const maxHints = 4; // Client doesn't know exact count

  // Reset between rounds
  useEffect(() => {
    setGuess("");
    setLastWrong(false);
  }, [currentQuestion?.id]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = guess.trim();
    if (!trimmed || timeRemaining <= 0 || pokestatsFound) return;

    submitPokestatsGuess(trimmed);
    setGuess("");
    inputRef.current?.focus();

    // Show wrong feedback briefly (overridden if correct via store update)
    setLastWrong(true);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setLastWrong(false), 800);
  }, [guess, timeRemaining, pokestatsFound, submitPokestatsGuess]);

  // Clear wrong feedback when found
  useEffect(() => {
    if (pokestatsFound) {
      setLastWrong(false);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    }
  }, [pokestatsFound]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleHint = useCallback(() => {
    if (pokestatsHints.length >= maxHints || pokestatsFound || timeRemaining <= 0) return;
    usePokestatsHint();
  }, [pokestatsHints.length, pokestatsFound, timeRemaining, usePokestatsHint]);

  const otherFoundCount = pokestatsFoundPlayers.filter(
    (p) => p.playerId !== myPlayerId
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-3 py-2 gap-2"
    >
      {/* Title */}
      <div className="text-center">
        <h2 className="text-base font-display font-bold text-surface-100">
          Qui est ce Pokémon ?
        </h2>
      </div>

      {/* Timer */}
      <TimerProgress timeRemaining={timeRemaining} totalTime={totalTime} />

      {/* Radar chart */}
      <div className="flex-shrink-0">
        <RadarChart stats={q.stats} />
      </div>

      {/* Stat bars (compact) */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 px-2">
        {STAT_KEYS.map((key, i) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-surface-500 w-7">
              {STAT_LABELS[i]}
            </span>
            <div className="flex-1 h-1.5 bg-surface-800 rounded-full mx-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((q.stats[key] / MAX_STAT) * 100, 100)}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
                className="h-full bg-yellow-400/70 rounded-full"
              />
            </div>
            <span className="text-[10px] font-bold text-yellow-400 w-6 text-right">
              {q.stats[key]}
            </span>
          </div>
        ))}
      </div>

      {/* Hints */}
      <AnimatePresence>
        {pokestatsHints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex flex-wrap items-center justify-center gap-2 px-2"
          >
            {pokestatsHints.map((hint, i) => (
              <HintBadge key={i} hint={hint} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Found indicator / Abandoned indicator / Other players */}
      <div className="flex items-center justify-center gap-2 min-h-[20px]">
        {pokestatsFound ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-500/20 border border-lime-500/30"
          >
            <Check className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-xs font-bold text-lime-400">
              Trouvé ! +{pokestatsMyPoints} pts
            </span>
          </motion.div>
        ) : pokestatsAbandoned && pokestatsAbandonData ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-surface-800/80 border border-surface-700"
          >
            <span className="text-xs text-surface-500">C&apos;était :</span>
            <div className="flex items-center gap-2">
              <img
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokestatsAbandonData.pokemonId}.png`}
                alt={pokestatsAbandonData.nameFr}
                className="w-12 h-12 object-contain"
              />
              <div>
                <span className="text-sm font-display font-bold text-surface-100">
                  {pokestatsAbandonData.nameFr}
                </span>
                <span className="text-xs text-surface-500 ml-1">
                  ({pokestatsAbandonData.nameEn})
                </span>
                <div className="flex gap-1 mt-0.5">
                  {pokestatsAbandonData.typesFr.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 text-surface-300">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <span className="text-[10px] text-red-400 font-semibold">+0 pts</span>
          </motion.div>
        ) : otherFoundCount > 0 ? (
          <span className="text-[10px] text-surface-500">
            {otherFoundCount} joueur{otherFoundCount > 1 ? "s" : ""} {otherFoundCount > 1 ? "ont" : "a"} trouvé
          </span>
        ) : null}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {lastWrong && !pokestatsFound && !pokestatsAbandoned && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-xs font-semibold text-red-400"
          >
            Raté, réessaye !
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input + controls */}
      <div className="space-y-2 pb-safe mt-auto">
        {/* Input row */}
        {!pokestatsFound && !pokestatsAbandoned && (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nom du Pokémon..."
              disabled={pokestatsFound || pokestatsAbandoned || timeRemaining <= 0}
              className="flex-1"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Button
              onClick={handleSubmit}
              disabled={!guess.trim() || pokestatsFound || pokestatsAbandoned || timeRemaining <= 0}
              size="icon"
              className="bg-brand-500 hover:bg-brand-600 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Hint + Abandon buttons */}
        {!pokestatsFound && !pokestatsAbandoned && timeRemaining > 0 && (
          <div className="flex justify-center gap-3">
            <Button
              onClick={handleHint}
              disabled={pokestatsHints.length >= maxHints}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
            >
              <Lightbulb className="w-3 h-3" />
              Indice
              {pokestatsHints.length > 0 && (
                <span className="text-surface-500">
                  ({pokestatsHints.length} utilisé{pokestatsHints.length > 1 ? "s" : ""})
                </span>
              )}
            </Button>
            <Button
              onClick={abandonPokestats}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Flag className="w-3 h-3" />
              Abandonner
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
