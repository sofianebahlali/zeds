"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Lightbulb, Check, Flag } from "lucide-react";
import { Button, Input, TimerProgress } from "@/components/ui";
import { useGameStore, useRoomStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { PokemonAttackQuestion, PokemonAttackHintData } from "@/types";

// ==========================================
// ATTACK NAME DISPLAY (first letter _ _ _ last letter)
// ==========================================

const SPECIAL_CHARS = new Set([" ", "'", "\u2019", "-"]);

function AttackNameDisplay({ nameMask, firstLetter, lastLetter, nameLength }: { nameMask?: string; firstLetter: string; lastLetter: string; nameLength: number }) {
  // Use nameMask if available (reveals spaces, apostrophes, hyphens)
  // Fallback to old behavior for backwards compat
  const mask = nameMask || (() => {
    let s = "";
    for (let i = 0; i < nameLength; i++) {
      if (i === 0) s += firstLetter;
      else if (i === nameLength - 1) s += lastLetter;
      else s += "_";
    }
    return s;
  })();

  // Split mask into "word groups" separated by spaces for better wrapping
  const cells: { char: string; revealed: boolean; isSpace: boolean }[] = mask.split("").map((ch, i) => {
    const isSpace = ch === " ";
    const isRevealed = ch !== "_";
    return {
      char: isSpace ? " " : ch.toUpperCase(),
      revealed: isRevealed,
      isSpace,
    };
  });

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {cells.map((cell, i) => (
        cell.isSpace ? (
          <div key={i} className="w-3" /> // Visual space between words
        ) : (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
            className={cn(
              "w-8 h-10 flex items-center justify-center rounded-lg text-lg font-display font-bold",
              cell.revealed
                ? "bg-brand-500/30 border-2 border-brand-500/50 text-brand-300"
                : "bg-surface-800 border-2 border-surface-700 text-surface-500"
            )}
          >
            {cell.char}
          </motion.div>
        )
      ))}
    </div>
  );
}

// ==========================================
// HINT DISPLAY
// ==========================================

const HINT_LABELS: Record<PokemonAttackHintData["hintType"], string> = {
  power: "Puissance",
  category: "Catégorie",
  type: "Type",
};

const HINT_ICONS: Record<PokemonAttackHintData["hintType"], string> = {
  power: "💥",
  category: "📋",
  type: "🔮",
};

const TYPE_COLORS: Record<string, string> = {
  Normal: "bg-gray-400",
  Feu: "bg-orange-500",
  Eau: "bg-blue-500",
  "Électrik": "bg-yellow-400",
  Plante: "bg-green-500",
  Glace: "bg-cyan-300",
  Combat: "bg-red-700",
  Poison: "bg-purple-500",
  Sol: "bg-amber-600",
  Vol: "bg-indigo-300",
  Psy: "bg-pink-500",
  Insecte: "bg-lime-500",
  Roche: "bg-yellow-700",
  Spectre: "bg-purple-700",
  Dragon: "bg-indigo-600",
  "Ténèbres": "bg-stone-700",
  Acier: "bg-slate-400",
  "Fée": "bg-pink-300",
};

function HintBadge({ hint }: { hint: PokemonAttackHintData }) {
  const isType = hint.hintType === "type";
  const colorClass = isType ? TYPE_COLORS[hint.value] || "bg-surface-600" : "bg-surface-700";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="flex items-center gap-1.5"
    >
      <span className="text-base">{HINT_ICONS[hint.hintType]}</span>
      <span className="text-[10px] text-surface-500 font-medium">
        {HINT_LABELS[hint.hintType]}:
      </span>
      <span
        className={cn(
          "text-[11px] font-bold px-2 py-0.5 rounded-full text-white",
          colorClass
        )}
      >
        {hint.value}
      </span>
    </motion.div>
  );
}

// ==========================================
// POINT LOSS INDICATOR
// ==========================================

function PointCostIndicator({ hintsUsed }: { hintsUsed: number }) {
  const pointsByHints = [200, 150, 100, 50];
  const currentMax = pointsByHints[Math.min(hintsUsed, 3)];
  const nextMax = hintsUsed < 3 ? pointsByHints[hintsUsed + 1] : null;
  const loss = nextMax !== null ? currentMax - nextMax : 0;

  if (hintsUsed >= 3) return null;

  return (
    <span className="text-[10px] text-red-400/70">
      (-{loss} pts)
    </span>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export function PokemonAttackGameScreen() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const pokemonAttackHints = useGameStore((s) => s.pokemonAttackHints);
  const pokemonAttackFound = useGameStore((s) => s.pokemonAttackFound);
  const pokemonAttackMyPoints = useGameStore((s) => s.pokemonAttackMyPoints);
  const pokemonAttackFoundPlayers = useGameStore((s) => s.pokemonAttackFoundPlayers);
  const pokemonAttackAbandoned = useGameStore((s) => s.pokemonAttackAbandoned);
  const pokemonAttackAbandonData = useGameStore((s) => s.pokemonAttackAbandonData);
  const players = useRoomStore((s) => s.players);
  const myPlayerId = usePlayerStore((s) => s.playerId);
  const { submitPokemonAttackGuess, usePokemonAttackHint, abandonPokemonAttack } = useSocket();

  const [guess, setGuess] = useState("");
  const [lastWrong, setLastWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  if (!currentQuestion || currentQuestion.type !== "pokemonattack") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = currentQuestion as any; // sanitized question with extra fields
  const totalTime = currentQuestion.timeLimit;
  const maxHints = 3;
  const firstLetter = q.firstLetter || "";
  const lastLetter = q.lastLetter || "";
  const nameLength = q.nameLength || 0;
  const nameMask = q.nameMask || undefined;

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
    if (!trimmed || timeRemaining <= 0 || pokemonAttackFound || pokemonAttackAbandoned) return;

    submitPokemonAttackGuess(trimmed);
    setGuess("");
    inputRef.current?.focus();

    setLastWrong(true);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setLastWrong(false), 800);
  }, [guess, timeRemaining, pokemonAttackFound, pokemonAttackAbandoned, submitPokemonAttackGuess]);

  useEffect(() => {
    if (pokemonAttackFound) {
      setLastWrong(false);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    }
  }, [pokemonAttackFound]);

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
    if (pokemonAttackHints.length >= maxHints || pokemonAttackFound || pokemonAttackAbandoned || timeRemaining <= 0) return;
    usePokemonAttackHint();
  }, [pokemonAttackHints.length, pokemonAttackFound, pokemonAttackAbandoned, timeRemaining, usePokemonAttackHint]);

  const otherFoundCount = pokemonAttackFoundPlayers.filter(
    (p) => p.playerId !== myPlayerId
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-3 py-2 gap-3"
    >
      {/* Title */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <span className="text-lg">⚔️</span>
          <span className="text-xs font-medium text-surface-300">Devine l&apos;Attaque</span>
        </div>
        <h2 className="text-base font-display font-bold text-surface-100">
          Quelle est cette attaque Pokémon ?
        </h2>
      </div>

      {/* Timer */}
      <TimerProgress timeRemaining={timeRemaining} totalTime={totalTime} />

      {/* Attack name display */}
      <div className="flex-shrink-0 py-4">
        <AttackNameDisplay
          nameMask={nameMask}
          firstLetter={firstLetter}
          lastLetter={lastLetter}
          nameLength={nameLength}
        />
        <p className="text-center text-xs text-surface-500 mt-2">
          {nameLength} caractère{nameLength > 1 ? "s" : ""} (espaces et tirets visibles)
        </p>
      </div>

      {/* Hints */}
      <AnimatePresence>
        {pokemonAttackHints.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex flex-wrap items-center justify-center gap-3 px-2"
          >
            {pokemonAttackHints.map((hint, i) => (
              <HintBadge key={i} hint={hint} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Found / Abandoned / Other players indicator */}
      <div className="flex items-center justify-center gap-2 min-h-[20px]">
        {pokemonAttackFound ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-500/20 border border-lime-500/30"
          >
            <Check className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-xs font-bold text-lime-400">
              Trouvé ! +{pokemonAttackMyPoints} pts
            </span>
          </motion.div>
        ) : pokemonAttackAbandoned && pokemonAttackAbandonData ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-surface-800/80 border border-surface-700"
          >
            <span className="text-xs text-surface-500">C&apos;était :</span>
            <span className="text-lg font-display font-bold text-brand-300">
              {pokemonAttackAbandonData.nameFr}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-surface-400">
              <span>{pokemonAttackAbandonData.attackType}</span>
              <span>·</span>
              <span>{pokemonAttackAbandonData.category}</span>
              {pokemonAttackAbandonData.power && (
                <>
                  <span>·</span>
                  <span>Puissance {pokemonAttackAbandonData.power}</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-red-400 font-semibold">+0 pts</span>
          </motion.div>
        ) : otherFoundCount > 0 ? (
          <span className="text-[10px] text-surface-500">
            {otherFoundCount} joueur{otherFoundCount > 1 ? "s" : ""} {otherFoundCount > 1 ? "ont" : "a"} trouvé
          </span>
        ) : null}
      </div>

      {/* Wrong guess feedback */}
      <AnimatePresence>
        {lastWrong && !pokemonAttackFound && !pokemonAttackAbandoned && (
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
        {!pokemonAttackFound && !pokemonAttackAbandoned && (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nom de l'attaque..."
              disabled={pokemonAttackFound || pokemonAttackAbandoned || timeRemaining <= 0}
              className="flex-1"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Button
              onClick={handleSubmit}
              disabled={!guess.trim() || pokemonAttackFound || pokemonAttackAbandoned || timeRemaining <= 0}
              size="icon"
              className="bg-brand-500 hover:bg-brand-600 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Hint + Abandon buttons */}
        {!pokemonAttackFound && !pokemonAttackAbandoned && timeRemaining > 0 && (
          <div className="flex justify-center gap-3">
            <Button
              onClick={handleHint}
              disabled={pokemonAttackHints.length >= maxHints}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
            >
              <Lightbulb className="w-3 h-3" />
              Indice
              {pokemonAttackHints.length > 0 && (
                <span className="text-surface-500">
                  ({pokemonAttackHints.length}/{maxHints})
                </span>
              )}
              <PointCostIndicator hintsUsed={pokemonAttackHints.length} />
            </Button>
            <Button
              onClick={abandonPokemonAttack}
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
