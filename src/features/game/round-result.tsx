"use client";

import { motion } from "framer-motion";
import { CheckCircle, XCircle, Trophy, Zap, Target } from "lucide-react";
import { Card, Avatar, Badge } from "@/components/ui";
import { useGameStore, useRoomStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { EstimationQuestion, DictationQuestion } from "@/types";

export function RoundResult() {
  const roundResult = useGameStore((s) => s.roundResult);
  const myAnswer = useGameStore((s) => s.myAnswer);
  const players = useRoomStore((s) => s.players);
  const { socket } = useSocket();

  if (!roundResult) return null;

  const myPlayerId = `player_${socket.id}`;
  const myResult = roundResult.scores.find((s) => s.playerId === myPlayerId);
  const isCorrect = myResult && myResult.points > 0;
  const isEstimation = roundResult.question.type === "estimation";
  const isDictation = roundResult.question.type === "dictation";
  const isParcours = roundResult.question.type === "parcours";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Result header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-8 pt-8"
      >
        <motion.div
          className={cn(
            "w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4",
            isCorrect ? "bg-success-500" : "bg-danger-500"
          )}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {isCorrect ? (
            <CheckCircle className="w-10 h-10 text-white" />
          ) : (
            <XCircle className="w-10 h-10 text-white" />
          )}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "text-2xl font-display font-bold",
            isCorrect ? "text-success-400" : "text-danger-400"
          )}
        >
          {isEstimation
            ? isCorrect
              ? "Bien estimé !"
              : "Pas facile !"
            : isDictation
            ? isCorrect
              ? "Bien écrit !"
              : "Piégé !"
            : isParcours
            ? isCorrect
              ? "Bien trouvé !"
              : "Perdu !"
            : isCorrect
            ? "Bonne réponse !"
            : "Raté !"}
        </motion.h2>

        {myResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2"
          >
            {isCorrect ? (
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-accent-400" />
                <span className="text-xl font-display font-bold text-surface-100">
                  +{myResult.points} points
                </span>
              </div>
            ) : (
              <span className="text-surface-500">0 points</span>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Correct answer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="mb-6">
          <div className="text-center">
            <p className="text-sm text-surface-400 mb-2">
              {isEstimation
                ? "Le vrai prix :"
                : isDictation
                ? "La phrase correcte :"
                : isParcours
                ? "Le joueur était :"
                : "La bonne réponse était :"}
            </p>
            <p
              className={cn(
                "font-display font-bold text-surface-100",
                isDictation ? "text-base leading-relaxed" : "text-2xl"
              )}
            >
              {roundResult.correctAnswer}
            </p>
            {isEstimation && (
              <p className="text-xs text-surface-500 mt-1">
                {(roundResult.question as EstimationQuestion).productName}
              </p>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Winner of the round */}
      {roundResult.winner && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card variant="gradient" className="mb-6">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-6 h-6 text-accent-400" />
              <div className="flex items-center gap-2">
                <Avatar emoji={roundResult.winner.avatar} size="sm" />
                <span className="font-medium text-surface-100">
                  {roundResult.winner.name}
                </span>
              </div>
              <Badge variant="warning" size="sm">
                {isEstimation
                  ? "Le plus proche !"
                  : isDictation
                  ? "Le plus précis !"
                  : isParcours
                  ? "Le plus rapide !"
                  : "Le plus rapide !"}
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* All players results */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex-1"
      >
        <h3 className="text-sm font-medium text-surface-400 mb-3">
          Résultats de la manche
        </h3>
        <div className="space-y-2">
          {roundResult.scores
            .sort((a, b) => b.points - a.points)
            .map((score, index) => {
              const player = players.find((p) => p.id === score.playerId);
              if (!player) return null;

              const answer = roundResult.answers.find(
                (a) => a.playerId === score.playerId
              );

              return (
                <motion.div
                  key={score.playerId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    "bg-surface-900 border border-surface-800",
                    score.playerId === myPlayerId && "border-brand-500/40"
                  )}
                >
                  <Avatar emoji={player.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-surface-100 truncate">
                        {player.name}
                      </span>
                      {answer?.isCorrect && (
                        <CheckCircle className="w-4 h-4 text-success-400 shrink-0" />
                      )}
                    </div>
                    {answer && (
                      <p
                        className={cn(
                          "text-sm truncate",
                          answer.isCorrect ? "text-success-400" : "text-surface-500"
                        )}
                      >
                        {isEstimation
                          ? (() => {
                              const guess = parseFloat(answer.answer.replace(",", "."));
                              const real = (roundResult.question as EstimationQuestion).correctValue;
                              const unit = (roundResult.question as EstimationQuestion).unit;
                              if (isNaN(guess)) return "Pas de réponse";
                              const dev = Math.round(Math.abs(guess - real) / real * 100);
                              return `${guess.toLocaleString("fr-FR")} ${unit} (${dev}% d'écart)`;
                            })()
                          : answer.answer || "Pas de réponse"}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "font-display font-bold",
                        score.points > 0 ? "text-success-400" : "text-surface-500"
                      )}
                    >
                      +{score.points}
                    </span>
                  </div>
                </motion.div>
              );
            })}
        </div>
      </motion.div>
    </motion.div>
  );
}
