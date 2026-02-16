"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useGameStore, useRoomStore } from "@/stores";
import { CountdownOverlay } from "./countdown-overlay";
import { QuestionDisplay } from "./question-display";
import { RoundResult } from "./round-result";
import { LeaderboardDisplay } from "./leaderboard-display";
import { ScreenContainer } from "@/components/layout";

export function GameScreen() {
  const status = useGameStore((s) => s.status);
  const currentRound = useGameStore((s) => s.currentRound);
  const totalRounds = useGameStore((s) => s.totalRounds);

  return (
    <ScreenContainer centered={false} padded={false}>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-20 h-1 bg-surface-800">
        <motion.div
          className="h-full bg-brand-500"
          initial={{ width: 0 }}
          animate={{ width: `${(currentRound / totalRounds) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Round indicator */}
      <div className="fixed top-4 left-4 right-4 z-10 flex justify-center">
        <motion.div
          key={currentRound}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-2 rounded-lg bg-surface-900 border border-surface-800"
        >
          <span className="text-sm font-medium text-surface-400">
            Question <span className="text-surface-100 font-display">{currentRound}</span>/{totalRounds}
          </span>
        </motion.div>
      </div>

      {/* Main content */}
      <div className="w-full h-screen-safe pt-16 pb-safe-bottom">
        <AnimatePresence mode="wait">
          {status === "countdown" && <CountdownOverlay key="countdown" />}
          {(status === "question" || status === "answering") && (
            <QuestionDisplay key="question" />
          )}
          {status === "revealing" && <RoundResult key="result" />}
          {status === "leaderboard" && <LeaderboardDisplay key="leaderboard" />}
        </AnimatePresence>
      </div>
    </ScreenContainer>
  );
}
