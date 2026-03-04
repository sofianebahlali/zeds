"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useGameStore, useRoomStore, usePlayerStore } from "@/stores";
import { CountdownOverlay } from "./countdown-overlay";
import { QuestionDisplay } from "./question-display";
import { RoundResult } from "./round-result";
import { LeaderboardDisplay } from "./leaderboard-display";
import { SuggestionPhaseScreen } from "./suggestion-phase-screen";
import { DrawingPhaseScreen } from "./drawing-phase-screen";
import { GuessingPhaseScreen } from "./guessing-phase-screen";
import { DrawingRevealScreen } from "./drawing-reveal-screen";
import { PetitBacValidationScreen } from "./petitbac-validation-screen";
import { GeoQuizValidationScreen } from "./geoquiz-validation-screen";
import { LangueValidationScreen } from "./langue-validation-screen";
import { LineupGameScreen } from "./lineup-game-screen";
import { ScreenContainer } from "@/components/layout";
import { GAME_MODES } from "@/types";
import { useSocket } from "@/hooks";

export function GameScreen() {
  const status = useGameStore((s) => s.status);
  const currentRound = useGameStore((s) => s.currentRound);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const teamData = useGameStore((s) => s.teamData);
  const room = useRoomStore((s) => s.room);
  const { socket } = useSocket();
  const myPlayerId = `player_${socket.id}`;
  const currentGameMode = room?.gameMode;
  const isDrawingMode = currentGameMode === "drawing";
  const isPetitBac = currentGameMode === "petitbac";
  const isGeoQuiz = currentGameMode === "geoquiz";
  const isLangue = currentGameMode === "langue";
  const isLineup = currentGameMode === "lineup";
  const currentModeInfo = GAME_MODES.find((m) => m.id === currentGameMode);

  const getPhaseLabel = () => {
    if (isPetitBac && status === "petitbac_validating") return "Validation";
    if (isGeoQuiz && status === "geoquiz_validating") return "Validation";
    if (isLangue && status === "langue_validating") return "Validation";
    if (!isDrawingMode) return null;
    switch (status) {
      case "suggesting": return "Suggère !";
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
              {currentModeInfo?.icon || "🎮"} {phaseLabel}
            </span>
          ) : (
            <span className="text-sm font-medium text-surface-400">
              {currentModeInfo?.icon}{" "}
              <span className="text-surface-100 font-display">{currentRound}</span>/{totalRounds}
            </span>
          )}
        </motion.div>
      </div>

      {/* Team banner */}
      {teamData && (
        <div className="fixed top-14 left-4 right-4 z-10 flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-900/90 border border-surface-700"
          >
            {teamData.teams.map((team) => {
              const isMyTeam = team.playerIds.includes(myPlayerId);
              return (
                <span
                  key={team.id}
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    team.id === "blue"
                      ? isMyTeam ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-400"
                      : isMyTeam ? "bg-red-500 text-white" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {team.name}
                  {isMyTeam && " (toi)"}
                </span>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* Main content */}
      <div className={`w-full h-screen-safe ${teamData ? "pt-24" : "pt-16"} pb-safe-bottom`}>
        <AnimatePresence mode="wait">
          {status === "countdown" && <CountdownOverlay key="countdown" />}
          {(status === "question" || status === "answering") && (
            isLineup ? <LineupGameScreen key="lineup" /> : <QuestionDisplay key="question" />
          )}
          {status === "revealing" && <RoundResult key="result" />}
          {status === "leaderboard" && <LeaderboardDisplay key="leaderboard" />}
          {status === "suggesting" && <SuggestionPhaseScreen key="suggesting" />}
          {status === "drawing" && <DrawingPhaseScreen key="drawing" />}
          {status === "guessing" && <GuessingPhaseScreen key="guessing" />}
          {status === "drawing_reveal" && <DrawingRevealScreen key="drawing-reveal" />}
          {status === "petitbac_validating" && <PetitBacValidationScreen key="petitbac-validation" />}
          {status === "geoquiz_validating" && <GeoQuizValidationScreen key="geoquiz-validation" />}
          {status === "langue_validating" && <LangueValidationScreen key="langue-validation" />}
        </AnimatePresence>
      </div>
    </ScreenContainer>
  );
}
