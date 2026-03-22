"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Clock } from "lucide-react";
import { Button, Input, TimerProgress } from "@/components/ui";
import { useGameStore, useRoomStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function LettresGameScreen() {
  const status = useGameStore((s) => s.status);
  const letters = useGameStore((s) => s.lettresLetters);
  const currentPickerId = useGameStore((s) => s.lettresCurrentPickerId);
  const currentPickerName = useGameStore((s) => s.lettresCurrentPickerName);
  const forcedChoice = useGameStore((s) => s.lettresForcedChoice);
  const timePerPick = useGameStore((s) => s.lettresTimePerPick);
  const pickIndex = useGameStore((s) => s.lettresPickIndex);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const myPlayerId = usePlayerStore((s) => s.playerId);
  const players = useRoomStore((s) => s.players);
  const { chooseLettresChoice, submitAnswer } = useSocket();

  const [word, setWord] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickTimeLeft, setPickTimeLeft] = useState(timePerPick);

  const isMyTurn = currentPickerId === myPlayerId;
  const totalPicks = 9;

  // Pick countdown timer
  useEffect(() => {
    if (status !== "lettres_drawing" || !currentPickerId) return;
    setPickTimeLeft(timePerPick);
    const interval = setInterval(() => {
      setPickTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, currentPickerId, pickIndex, timePerPick]);

  // Auto-focus input in find phase
  useEffect(() => {
    if (status === "lettres_finding" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status]);

  const handleChoose = (choice: "voyelle" | "consonne") => {
    if (!isMyTurn) return;
    chooseLettresChoice(choice);
  };

  const handleSubmitWord = () => {
    const trimmed = word.trim();
    if (!trimmed || hasAnswered) return;
    submitAnswer(trimmed.toUpperCase());
    useGameStore.setState({ hasAnswered: true, myAnswer: trimmed.toUpperCase() });
  };

  // ==========================================
  // DRAWING PHASE
  // ==========================================
  if (status === "lettres_drawing") {
    const currentPickerPlayer = players.find((p) => p.id === currentPickerId);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center h-full px-5"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
            <span className="text-lg">🔠</span>
            <span className="text-xs font-medium text-surface-300">Tirage des lettres</span>
          </div>
          <p className="text-surface-400 text-sm">
            {pickIndex}/{totalPicks} lettres tirées
          </p>
        </div>

        {/* Letters grid */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-xs">
          {Array.from({ length: totalPicks }).map((_, i) => (
            <motion.div
              key={i}
              initial={i === letters.length - 1 ? { scale: 0, rotateY: 180 } : false}
              animate={{ scale: 1, rotateY: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center text-xl font-display font-bold border-2",
                i < letters.length
                  ? "bg-blue-500/20 border-blue-400/50 text-blue-200"
                  : "bg-surface-800 border-surface-700 text-surface-600"
              )}
            >
              {i < letters.length ? letters[i] : "?"}
            </motion.div>
          ))}
        </div>

        {/* Current picker info */}
        {currentPickerId && (
          <div className="text-center mb-6">
            {/* Pick timer */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-surface-400" />
              <span className={cn(
                "text-sm font-bold",
                pickTimeLeft <= 2 ? "text-danger-400" : "text-surface-300"
              )}>
                {pickTimeLeft}s
              </span>
            </div>

            {isMyTurn ? (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-display font-bold text-brand-400 mb-1"
              >
                C&apos;est ton tour !
              </motion.p>
            ) : (
              <p className="text-surface-400 text-sm">
                <span className="text-surface-100 font-medium">
                  {currentPickerPlayer?.avatar} {currentPickerName}
                </span>{" "}
                choisit...
              </p>
            )}

            {forcedChoice && (
              <p className="text-xs text-amber-400 mt-1">
                Choix forcé : {forcedChoice}
              </p>
            )}
          </div>
        )}

        {/* Choice buttons (only for current picker) */}
        {isMyTurn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3 w-full max-w-xs"
          >
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => handleChoose("voyelle")}
              disabled={forcedChoice === "consonne"}
              className={cn(
                "!border-blue-500/40 !bg-blue-500/10 hover:!bg-blue-500/20",
                forcedChoice === "voyelle" && "!border-blue-400 !bg-blue-500/30 ring-2 ring-blue-400/50"
              )}
            >
              <span className="text-blue-300 font-display font-bold">Voyelle</span>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => handleChoose("consonne")}
              disabled={forcedChoice === "voyelle"}
              className={cn(
                "!border-indigo-500/40 !bg-indigo-500/10 hover:!bg-indigo-500/20",
                forcedChoice === "consonne" && "!border-indigo-400 !bg-indigo-500/30 ring-2 ring-indigo-400/50"
              )}
            >
              <span className="text-indigo-300 font-display font-bold">Consonne</span>
            </Button>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // ==========================================
  // FINDING PHASE
  // ==========================================
  if (status === "lettres_finding") {
    const totalTime = 25;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col items-center justify-center h-full px-5"
      >
        {/* Timer */}
        <div className="w-full max-w-sm mb-6">
          <TimerProgress
            timeRemaining={timeRemaining}
            totalTime={totalTime}
          />
        </div>

        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-lg font-display font-bold text-surface-100">
            Trouve le mot le plus long !
          </h2>
          <p className="text-surface-400 text-xs mt-1">
            Utilise uniquement les lettres tirées
          </p>
        </div>

        {/* Letters display */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-xs">
          {letters.map((letter, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 400 }}
              className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-display font-bold bg-blue-500/20 border-2 border-blue-400/50 text-blue-200"
            >
              {letter}
            </motion.div>
          ))}
        </div>

        {/* Word input */}
        {!hasAnswered ? (
          <div className="w-full max-w-sm space-y-3">
            <div className="relative">
              <Input
                ref={inputRef}
                value={word}
                onChange={(e) => setWord(e.target.value.toUpperCase())}
                placeholder="Ton mot..."
                className="text-center text-lg font-display font-bold uppercase tracking-widest pr-12"
                maxLength={9}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitWord();
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
              {word.trim().length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-surface-400 bg-surface-800 px-1.5 py-0.5 rounded">
                  {word.trim().length}
                </span>
              )}
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleSubmitWord}
              disabled={!word.trim()}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Valider ({word.trim().length || 0} lettres)
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="px-6 py-4 rounded-xl bg-surface-800 border border-surface-700 mb-3">
              <p className="text-xs text-surface-500 mb-1">Ton mot</p>
              <p className="text-2xl font-display font-bold text-brand-400 tracking-widest">
                {useGameStore.getState().myAnswer}
              </p>
              <p className="text-xs text-surface-400 mt-1">
                {useGameStore.getState().myAnswer?.length} lettres
              </p>
            </div>
            <p className="text-surface-500 text-sm">
              En attente des autres joueurs...
            </p>
          </motion.div>
        )}
      </motion.div>
    );
  }

  return null;
}
