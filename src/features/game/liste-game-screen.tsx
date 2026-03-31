"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Check, Trophy, Square } from "lucide-react";
import { Button, Input, TimerProgress } from "@/components/ui";
import { useGameStore, useRoomStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { ListeQuestion } from "@/types";

export function ListeGameScreen() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const listeFoundItems = useGameStore((s) => s.listeFoundItems);
  const listeMyFoundCount = useGameStore((s) => s.listeMyFoundCount);
  const listeFinishedPlayers = useGameStore((s) => s.listeFinishedPlayers);
  const players = useRoomStore((s) => s.players);
  const myPlayerId = usePlayerStore((s) => s.playerId);
  const { submitListeAnswer, submitListeFinish } = useSocket();

  const [guess, setGuess] = useState("");
  const [lastCorrect, setLastCorrect] = useState<string | null>(null);
  const [lastWrong, setLastWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevFoundCountRef = useRef(0);

  if (!currentQuestion || currentQuestion.type !== "liste") return null;

  const q = currentQuestion as ListeQuestion;
  const totalItems = q.items.length;
  const totalTime = q.timeLimit;
  const hasFinished = listeFinishedPlayers.includes(myPlayerId);
  const finishedCount = listeFinishedPlayers.length;
  const totalPlayers = players.length;

  // Build set of found item indices (by me)
  const myFoundIndices = useMemo(() => {
    const set = new Set<number>();
    for (const item of listeFoundItems) {
      if (item.foundByPlayerId === myPlayerId) {
        set.add(item.itemIndex);
      }
    }
    return set;
  }, [listeFoundItems, myPlayerId]);

  // Get the answer text for a found item (only my own)
  const getFoundAnswer = useCallback(
    (index: number) => {
      const item = listeFoundItems.find((i) => i.itemIndex === index && i.foundByPlayerId === myPlayerId);
      return item?.answer || "";
    },
    [listeFoundItems, myPlayerId]
  );

  // Detect new found item for feedback
  useEffect(() => {
    if (listeMyFoundCount > prevFoundCountRef.current) {
      const latestFound = listeFoundItems
        .filter((i) => i.foundByPlayerId === myPlayerId)
        .slice(-1)[0];
      if (latestFound) {
        setLastCorrect(latestFound.answer);
        setLastWrong(false);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setLastCorrect(null), 1500);
      }
    }
    prevFoundCountRef.current = listeMyFoundCount;
  }, [listeMyFoundCount, listeFoundItems, myPlayerId]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = guess.trim();
    if (!trimmed || timeRemaining <= 0 || hasFinished) return;

    const prevCount = listeMyFoundCount;
    submitListeAnswer(trimmed);
    setGuess("");
    inputRef.current?.focus();

    // Show wrong feedback briefly (will be overridden if correct)
    setTimeout(() => {
      if (useGameStore.getState().listeMyFoundCount === prevCount) {
        setLastWrong(true);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setLastWrong(false), 800);
      }
    }, 150);
  }, [guess, timeRemaining, hasFinished, submitListeAnswer, listeMyFoundCount]);

  const handleFinish = useCallback(() => {
    if (!hasFinished) {
      submitListeFinish();
    }
  }, [hasFinished, submitListeFinish]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-3 py-2 gap-2"
    >
      {/* Quiz title */}
      <div className="text-center space-y-1">
        <div className="text-[11px] text-surface-400 font-medium uppercase tracking-wide">
          {q.category} — {q.subcategory}
        </div>
        <h2 className="text-base font-display font-bold text-surface-100">
          {q.title}
        </h2>
      </div>

      {/* Timer */}
      <TimerProgress timeRemaining={timeRemaining} totalTime={totalTime} />

      {/* Score counter */}
      <div className="flex items-center justify-center gap-2">
        <Trophy className="w-3.5 h-3.5 text-lime-400" />
        <span className="text-sm font-semibold text-surface-200">
          <span className="text-lime-400">{listeMyFoundCount}</span>
          <span className="text-surface-500">/{totalItems}</span>
        </span>
        <span className="text-[10px] text-surface-500">trouvés</span>
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-2">
        <div className="grid grid-cols-2 gap-1.5">
          {q.items.map((item, idx) => {
            const foundByMe = myFoundIndices.has(idx);
            const answer = foundByMe ? getFoundAnswer(idx) : "";

            return (
              <motion.div
                key={idx}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all duration-300",
                  foundByMe
                    ? "bg-lime-500/10 border-lime-500/30 text-lime-300"
                    : "bg-surface-900/50 border-surface-800 text-surface-600"
                )}
                initial={false}
                animate={foundByMe ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.2 }}
              >
                <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                  {foundByMe ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <span className="text-[10px] text-surface-600">{idx + 1}</span>
                  )}
                </span>
                <span className="truncate font-medium">
                  {foundByMe ? answer : (item.hint || "???")}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Input + controls */}
      <div className="space-y-2 pb-safe">
        {/* Feedback */}
        <AnimatePresence>
          {lastCorrect && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs font-semibold text-lime-400"
            >
              {lastCorrect}
            </motion.div>
          )}
          {lastWrong && !lastCorrect && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs font-semibold text-red-400"
            >
              Mauvaise réponse
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasFinished ? "Tu as terminé !" : "Tape ta réponse..."}
            disabled={hasFinished || timeRemaining <= 0}
            className="flex-1"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <Button
            onClick={handleSubmit}
            disabled={!guess.trim() || hasFinished || timeRemaining <= 0}
            size="icon"
            className="bg-brand-500 hover:bg-brand-600 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Finish button */}
        <div className="flex items-center justify-between">
          <Button
            onClick={handleFinish}
            disabled={hasFinished}
            variant="outline"
            size="sm"
            className={cn(
              "text-xs",
              hasFinished && "opacity-50"
            )}
          >
            <Square className="w-3 h-3 mr-1" />
            {hasFinished ? "Terminé !" : "J'ai fini"}
          </Button>
          {finishedCount > 0 && (
            <span className="text-[10px] text-surface-500">
              {finishedCount}/{totalPlayers} ont terminé
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
