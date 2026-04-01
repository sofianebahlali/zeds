"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Check, Trophy, Flag } from "lucide-react";
import Image from "next/image";
import { Button, Input, TimerProgress } from "@/components/ui";
import { useGameStore, useRoomStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { PokemonSilhouetteQuestion, PokemonAbandonResult } from "@/types";

export function PokemonGameScreen() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const pokemonFound = useGameStore((s) => s.pokemonFound);
  const pokemonMyPoints = useGameStore((s) => s.pokemonMyPoints);
  const pokemonIsFirst = useGameStore((s) => s.pokemonIsFirst);
  const pokemonFoundPlayers = useGameStore((s) => s.pokemonFoundPlayers);
  const pokemonAbandoned = useGameStore((s) => s.pokemonAbandoned);
  const pokemonAbandonData = useGameStore((s) => s.pokemonAbandonData);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const players = useRoomStore((s) => s.players);
  const myPlayerId = usePlayerStore((s) => s.playerId);
  const { submitPokemonGuess, abandonPokemon } = useSocket();

  const [guess, setGuess] = useState("");
  const [lastWrong, setLastWrong] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isSolo = players.length === 1;

  if (!currentQuestion || currentQuestion.type !== "pokemon") return null;

  const q = currentQuestion as PokemonSilhouetteQuestion;
  const totalTime = q.timeLimit;

  // Reset between rounds
  useEffect(() => {
    setGuess("");
    setLastWrong(false);
    setRevealed(false);
  }, [currentQuestion?.id]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Reveal image when found or abandoned
  useEffect(() => {
    if (pokemonFound || pokemonAbandoned) {
      setRevealed(true);
    }
  }, [pokemonFound, pokemonAbandoned]);

  const handleSubmit = useCallback(() => {
    const trimmed = guess.trim();
    if (!trimmed || timeRemaining <= 0 || pokemonFound || pokemonAbandoned) return;

    if (isSolo) {
      submitPokemonGuess(trimmed);
      setGuess("");
      inputRef.current?.focus();

      // Show wrong feedback briefly
      setLastWrong(true);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setLastWrong(false), 800);
    } else {
      // Multi: single answer submission
      submitPokemonGuess(trimmed);
    }
  }, [guess, timeRemaining, pokemonFound, pokemonAbandoned, isSolo, submitPokemonGuess]);

  // Clear wrong feedback when found
  useEffect(() => {
    if (pokemonFound) {
      setLastWrong(false);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    }
  }, [pokemonFound]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const otherFoundCount = pokemonFoundPlayers.filter(
    (p) => p.playerId !== myPlayerId
  ).length;

  // In multi mode, if already answered (submitted for host review)
  const waitingForValidation = !isSolo && hasAnswered && !pokemonFound && !pokemonAbandoned;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-3 py-2 gap-3"
    >
      {/* Title */}
      <div className="text-center">
        <h2 className="text-base font-display font-bold text-surface-100">
          Quel est ce Pokémon ?
        </h2>
      </div>

      {/* Timer */}
      <TimerProgress timeRemaining={timeRemaining} totalTime={totalTime} />

      {/* Silhouette / Revealed image */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <motion.div
          className="relative w-64 h-64 max-w-[70vw] max-h-[40vh]"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Image
            src={q.imageUrl}
            alt="Pokémon"
            fill
            className={cn(
              "object-contain transition-all duration-700 ease-out",
              !revealed && "brightness-0 invert"
            )}
            priority
            unoptimized
          />
        </motion.div>
      </div>

      {/* Found / Abandoned / Waiting indicator */}
      <div className="flex items-center justify-center gap-2 min-h-[20px]">
        {pokemonFound ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-500/20 border border-lime-500/30"
          >
            <Check className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-xs font-bold text-lime-400">
              Trouvé ! +{pokemonMyPoints} pts
              {pokemonIsFirst && (
                <span className="ml-1 text-yellow-400">
                  <Trophy className="w-3 h-3 inline" /> Premier !
                </span>
              )}
            </span>
          </motion.div>
        ) : pokemonAbandoned && pokemonAbandonData ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-surface-800/80 border border-surface-700"
          >
            <span className="text-xs text-surface-500">C&apos;était :</span>
            <span className="text-sm font-display font-bold text-surface-100">
              {pokemonAbandonData.nameFr}
            </span>
            <span className="text-xs text-surface-500">
              ({pokemonAbandonData.nameEn})
            </span>
            <div className="flex gap-1 mt-0.5">
              {pokemonAbandonData.typesFr.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 text-surface-300">
                  {t}
                </span>
              ))}
            </div>
            <span className="text-[10px] text-red-400 font-semibold">+0 pts</span>
          </motion.div>
        ) : waitingForValidation ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-surface-400"
          >
            Réponse envoyée, en attente de validation...
          </motion.div>
        ) : otherFoundCount > 0 ? (
          <span className="text-[10px] text-surface-500">
            {otherFoundCount} joueur{otherFoundCount > 1 ? "s" : ""}{" "}
            {otherFoundCount > 1 ? "ont" : "a"} trouvé
          </span>
        ) : null}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {lastWrong && !pokemonFound && !pokemonAbandoned && (
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
        {!pokemonFound && !pokemonAbandoned && !waitingForValidation && (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nom du Pokémon..."
              disabled={pokemonFound || pokemonAbandoned || timeRemaining <= 0}
              className="flex-1"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Button
              onClick={handleSubmit}
              disabled={!guess.trim() || pokemonFound || pokemonAbandoned || timeRemaining <= 0}
              size="icon"
              className="bg-brand-500 hover:bg-brand-600 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Abandon button */}
        {!pokemonFound && !pokemonAbandoned && !waitingForValidation && timeRemaining > 0 && (
          <div className="flex justify-center">
            <Button
              onClick={abandonPokemon}
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
