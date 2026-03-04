"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Trophy, Zap } from "lucide-react";
import { Card, Avatar, Badge } from "@/components/ui";
import { useGameStore, useRoomStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { EstimationQuestion, PetitBacQuestion, QCMQuestion, MathsQuestion } from "@/types";

const PETITBAC_CATEGORY_ICONS: Record<string, string> = {
  "Prénom": "👤",
  "Pokémon": "⚡",
  "Joueur de foot": "⚽",
  "Plat": "🍽️",
  "Métier": "💼",
  "Fruit/Légume": "🍎",
  "Film": "🎬",
  "Partie du corps/os": "🦴",
};

export function RoundResult() {
  const roundResult = useGameStore((s) => s.roundResult);
  const players = useRoomStore((s) => s.players);
  const petitBacValidationData = useGameStore((s) => s.petitBacValidationData);
  const petitBacValidatedAnswers = useGameStore((s) => s.petitBacValidatedAnswers);
  const { socket } = useSocket();

  if (!roundResult) return null;

  const myPlayerId = `player_${socket.id}`;
  const myResult = roundResult.scores.find((s) => s.playerId === myPlayerId);
  const isCorrect = myResult && myResult.points > 0;
  const isEstimation = roundResult.question.type === "estimation";
  const isDictation = roundResult.question.type === "dictation";
  const isParcours = roundResult.question.type === "parcours";
  const isPetitBac = roundResult.question.type === "petitbac";
  const isGeoQuiz = roundResult.question.type === "geoquiz";

  if (isPetitBac) {
    return (
      <PetitBacRoundResult
        roundResult={roundResult}
        players={players}
        myPlayerId={myPlayerId}
        myResult={myResult}
        isCorrect={!!isCorrect}
        petitBacValidationData={petitBacValidationData}
        petitBacValidatedAnswers={petitBacValidatedAnswers}
      />
    );
  }

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
            : isGeoQuiz
            ? isCorrect
              ? "Bien localisé !"
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
                : isGeoQuiz
                ? "La ville était :"
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
                  : isGeoQuiz
                  ? "Globe-trotteur !"
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
                          : (roundResult.question.type === "qcm" || roundResult.question.type === "maths")
                          ? (() => {
                              const idx = parseInt(answer.answer, 10);
                              const opts = (roundResult.question as QCMQuestion | MathsQuestion).options;
                              return (!isNaN(idx) && opts && opts[idx]) ? opts[idx] : (answer.answer || "Pas de réponse");
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

// ==========================================
// PETIT BAC ROUND RESULT
// ==========================================

interface PetitBacRoundResultProps {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  players: ReturnType<typeof useRoomStore.getState>["players"];
  myPlayerId: string;
  myResult: { playerId: string; points: number; total: number } | undefined;
  isCorrect: boolean;
  petitBacValidationData: ReturnType<typeof useGameStore.getState>["petitBacValidationData"];
  petitBacValidatedAnswers: ReturnType<typeof useGameStore.getState>["petitBacValidatedAnswers"];
}

function PetitBacRoundResult({
  roundResult,
  players,
  myPlayerId,
  myResult,
  isCorrect,
  petitBacValidationData,
  petitBacValidatedAnswers,
}: PetitBacRoundResultProps) {
  const q = roundResult.question as PetitBacQuestion;

  // Parse all player answers from JSON
  const parsedAnswers = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const answer of roundResult.answers) {
      try {
        map[answer.playerId] = JSON.parse(answer.answer);
      } catch {
        map[answer.playerId] = {};
      }
    }
    return map;
  }, [roundResult.answers]);

  // Build player info list (sorted by score)
  const sortedScores = [...roundResult.scores].sort((a, b) => b.points - a.points);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Compact header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-4 pt-4"
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
            <span className="text-xl font-display font-black text-white">
              {q.letter}
            </span>
          </div>
          <div className="text-left">
            <h2
              className={cn(
                "text-lg font-display font-bold",
                isCorrect ? "text-success-400" : "text-danger-400"
              )}
            >
              {isCorrect ? "Bien joué !" : "Pas facile !"}
            </h2>
            {myResult && (
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-accent-400" />
                <span className="text-base font-display font-bold text-surface-100">
                  +{myResult.points} pts
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Winner */}
      {roundResult.winner && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <Card variant="gradient">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-5 h-5 text-accent-400" />
              <Avatar emoji={roundResult.winner.avatar} size="sm" />
              <span className="font-medium text-surface-100">
                {roundResult.winner.name}
              </span>
              <Badge variant="warning" size="sm">
                Meilleur score !
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Category-by-category answers */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3"
      >
        {q.categories.map((category, catIdx) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + catIdx * 0.06 }}
            className="rounded-xl bg-surface-900 border border-surface-800 overflow-hidden"
          >
            {/* Category header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 border-b border-surface-800">
              <span className="text-sm">
                {PETITBAC_CATEGORY_ICONS[category] || "📝"}
              </span>
              <span className="text-xs font-medium text-surface-300">
                {category}
              </span>
            </div>

            {/* Player answers for this category */}
            <div className="divide-y divide-surface-800/50">
              {sortedScores.map((score) => {
                const player = players.find((p) => p.id === score.playerId);
                if (!player) return null;

                const answer = (parsedAnswers[score.playerId]?.[category] || "").trim();
                const isValidated = petitBacValidatedAnswers?.[category]?.includes(score.playerId) ?? false;

                return (
                  <div
                    key={score.playerId}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5",
                      score.playerId === myPlayerId && "bg-brand-500/5"
                    )}
                  >
                    <Avatar emoji={player.avatar} size="sm" />
                    <span className="text-xs text-surface-400 w-14 truncate shrink-0">
                      {player.name}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm truncate",
                        !answer
                          ? "text-surface-600 italic"
                          : isValidated
                          ? "text-surface-100"
                          : "text-surface-500 line-through"
                      )}
                    >
                      {answer || "—"}
                    </span>
                    {answer && (
                      <span className="shrink-0 flex items-center gap-1">
                        {isValidated ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-success-400" />
                            <span className="text-xs font-bold text-success-400">
                              30
                            </span>
                          </>
                        ) : (
                          <XCircle className="w-4 h-4 text-danger-400/60" />
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Score summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-3"
      >
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {sortedScores.map((score) => {
            const player = players.find((p) => p.id === score.playerId);
            if (!player) return null;
            return (
              <div
                key={score.playerId}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                  "bg-surface-900 border border-surface-800",
                  score.playerId === myPlayerId && "border-brand-500/40"
                )}
              >
                <Avatar emoji={player.avatar} size="sm" />
                <span className="text-xs text-surface-400">{player.name}</span>
                <span
                  className={cn(
                    "text-sm font-display font-bold",
                    score.points > 0 ? "text-success-400" : "text-surface-500"
                  )}
                >
                  +{score.points}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
