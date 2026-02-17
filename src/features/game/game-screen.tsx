"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useGameStore, useRoomStore } from "@/stores";
import { CountdownOverlay } from "./countdown-overlay";
import { QuestionDisplay } from "./question-display";
import { RoundResult } from "./round-result";
import { LeaderboardDisplay } from "./leaderboard-display";
import { DrawingPhaseScreen } from "./drawing-phase-screen";
import { GuessingPhaseScreen } from "./guessing-phase-screen";
import { DrawingRevealScreen } from "./drawing-reveal-screen";
import { ScreenContainer } from "@/components/layout";

export function GameScreen() {
  const status = useGameStore((s) => s.status);
  const currentRound = useGameStore((s) => s.currentRound);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const room = useRoomStore((s) => s.room);
  const isDrawingMode = room?.gameMode === "drawing";

  const getPhaseLabel = () => {
    if (!isDrawingMode) return null;
    switch (status) {
      case "drawing": return "Dessine !";
      case "guessing": return "Devine !";
      case "drawing_reveal": return "Résultats";
      default: return null;
    }
  };

  const phaseLabel = getPhaseLabel();

  return (
    <ScreenContainer centered={false} padded={false}>
      {/* Progress bar */}
      {!isDrawingMode && (
        <div className="fixed top-0 left-0 right-0 z-20 h-1 bg-surface-800">
          <motion.div
            className="h-full bg-brand-500"
            initial={{ width: 0 }}
            animate={{ width: `${(currentRound / totalRounds) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Round/Phase indicator */}
      <div className="fixed top-4 left-4 right-4 z-10 flex justify-center">
        <motion.div
          key={phaseLabel || currentRound}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-2 rounded-lg bg-surface-900 border border-surface-800"
        >
          {phaseLabel ? (
            <span className="text-sm font-medium text-surface-100 font-display">
              🎨 {phaseLabel}
            </span>
          ) : (
            <span className="text-sm font-medium text-surface-400">
              Question <span className="text-surface-100 font-display">{currentRound}</span>/{totalRounds}
            </span>
          )}
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
          {status === "drawing" && <DrawingPhaseScreen key="drawing" />}
          {status === "guessing" && <GuessingPhaseScreen key="guessing" />}
          {status === "drawing_reveal" && <DrawingRevealScreen key="drawing-reveal" />}
        </AnimatePresence>
      </div>
    </ScreenContainer>
  );
}
