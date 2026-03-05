"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Send, CheckCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useGameStore } from "@/stores";
import { useSocket } from "@/hooks";
import { formatTime } from "@/lib/utils";

export function SuggestionPhaseScreen() {
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const { submitDrawingSuggestion } = useSocket();
  const [suggestion, setSuggestion] = useState("");
  const suggestionRef = useRef(suggestion);
  const autoSubmittedRef = useRef(false);
  suggestionRef.current = suggestion;

  // Auto-submit suggestion when timer expires (if player typed something)
  useEffect(() => {
    if (timeRemaining <= 0 && !hasAnswered && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      if (suggestionRef.current.trim()) {
        submitDrawingSuggestion(suggestionRef.current.trim());
      }
      // If empty, server will use fallback phrase from pool
    }
  }, [timeRemaining, hasAnswered, submitDrawingSuggestion]);

  const handleSubmit = () => {
    if (hasAnswered || !suggestion.trim()) return;
    submitDrawingSuggestion(suggestion.trim());
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-4 pb-4 pb-safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Timer */}
      <div className="w-full max-w-md pt-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-purple-500 rounded-full"
              animate={{ width: `${Math.max(0, (timeRemaining / 30) * 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-sm font-mono font-bold text-surface-300 w-12 text-right">
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      {/* Icon + Title */}
      <motion.div
        className="flex flex-col items-center gap-3 mb-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center">
          <Lightbulb className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-xl font-display font-bold text-surface-100 text-center">
          Suggère une idée de dessin !
        </h2>
        <p className="text-surface-400 text-sm text-center max-w-xs">
          Propose une phrase que quelqu&apos;un d&apos;autre devra dessiner
        </p>
      </motion.div>

      {/* Input */}
      <div className="w-full max-w-md">
        {!hasAnswered ? (
          <motion.div
            className="space-y-3"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Input
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Ex: Un chat qui fait du surf..."
              autoFocus
              className="text-center text-lg"
              maxLength={80}
            />
            <Button
              variant="primary"
              className="w-full"
              onClick={handleSubmit}
              disabled={!suggestion.trim()}
            >
              <Send className="w-4 h-4" />
              Valider ma suggestion
            </Button>
          </motion.div>
        ) : (
          <motion.div
            className="flex flex-col items-center gap-2 py-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <CheckCircle className="w-8 h-8 text-success-400" />
            <span className="text-success-400 font-semibold text-center">
              Suggestion envoyée ! En attente des autres...
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
