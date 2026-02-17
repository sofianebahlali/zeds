"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import { useGameStore } from "@/stores";
import { useSocket } from "@/hooks";
import { formatTime } from "@/lib/utils";

export function GuessingPhaseScreen() {
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const drawingToGuess = useGameStore((s) => s.drawingToGuess);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const { submitDrawingGuess } = useSocket();
  const [guess, setGuess] = useState("");

  const handleSubmit = () => {
    if (hasAnswered || !guess.trim()) return;
    submitDrawingGuess(guess.trim());
  };

  return (
    <motion.div
      className="flex flex-col h-full px-4 pb-4 pb-safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Timer */}
      <div className="pt-2 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent-500 rounded-full"
              animate={{ width: `${Math.max(0, (timeRemaining / 45) * 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-sm font-mono font-bold text-surface-300 w-12 text-right">
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-3">
        <h2 className="text-lg font-display font-bold text-surface-100">
          Que représente ce dessin ?
        </h2>
      </div>

      {/* Drawing image */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="w-full max-w-sm aspect-square rounded-xl overflow-hidden bg-white shadow-lg">
          {drawingToGuess ? (
            <img
              src={drawingToGuess}
              alt="Dessin à deviner"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-surface-500">
              Chargement du dessin...
            </div>
          )}
        </div>
      </div>

      {/* Guess input */}
      <div className="mt-3">
        {!hasAnswered ? (
          <div className="space-y-2">
            <Input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Tape ta réponse..."
              autoFocus
              className="text-center text-lg"
            />
            <Button
              variant="primary"
              className="w-full"
              onClick={handleSubmit}
              disabled={!guess.trim()}
            >
              <Send className="w-4 h-4" />
              Valider
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3">
            <CheckCircle className="w-5 h-5 text-success-400" />
            <span className="text-success-400 font-semibold">Réponse envoyée ! En attente des autres...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
