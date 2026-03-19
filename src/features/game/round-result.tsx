"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Trophy, Zap } from "lucide-react";
import { Card, Avatar, Badge } from "@/components/ui";
import { useGameStore, useRoomStore } from "@/stores";
import { useChatStore } from "@/stores/chat-store";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { EstimationQuestion, PetitBacQuestion, QCMQuestion, MathsQuestion, ChronoQuestion, ConsensusQuestion } from "@/types";

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

function LaughButton({ targetPlayerId, roundNumber, myPlayerId }: { targetPlayerId: string; roundNumber: number; myPlayerId: string }) {
  const { sendLaughReaction } = useSocket();
  const reactions = useChatStore((s) => s.reactions);

  const laughCount = reactions.filter(
    (r) => r.targetPlayerId === targetPlayerId && r.roundNumber === roundNumber
  ).length;

  const alreadyLaughed = reactions.some(
    (r) => r.playerId === myPlayerId && r.targetPlayerId === targetPlayerId && r.roundNumber === roundNumber
  );

  if (targetPlayerId === myPlayerId) return null;

  return (
    <button
      onClick={() => {
        if (!alreadyLaughed) sendLaughReaction(targetPlayerId, roundNumber);
      }}
      className={cn(
        "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all",
        alreadyLaughed
          ? "bg-amber-500/20 border border-amber-500/30"
          : "bg-surface-800 border border-surface-700 hover:bg-amber-500/10 hover:border-amber-500/20"
      )}
    >
      <span className="text-sm">😂</span>
      <AnimatePresence>
        {laughCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-amber-400 font-bold"
          >
            {laughCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

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
  const isJerseyNumber = roundResult.question.type === "jerseynumber";
  const isChrono = roundResult.question.type === "chrono";
  const isConsensus = roundResult.question.type === "consensus";

  if (isChrono) {
    return (
      <ChronoRoundResult
        roundResult={roundResult}
        players={players}
        myPlayerId={myPlayerId}
        myResult={myResult}
        isCorrect={!!isCorrect}
      />
    );
  }

  if (isConsensus) {
    return (
      <ConsensusRoundResult
        roundResult={roundResult}
        players={players}
        myPlayerId={myPlayerId}
        myResult={myResult}
        isCorrect={!!isCorrect}
      />
    );
  }

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
            : isJerseyNumber
            ? isCorrect
              ? "Bien deviné !"
              : "Perdu !"
            : isConsensus
            ? isCorrect
              ? "Dans le consensus !"
              : "Pas dans la majorité !"
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
                : isJerseyNumber
                ? "Le vrai numéro :"
                : isConsensus
                ? "Réponse la plus populaire :"
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
                  : isChrono
                  ? "Le plus précis !"
                  : isConsensus
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
                        {isChrono
                          ? (() => {
                              const measured = parseInt(answer.answer, 10);
                              const target = (roundResult.question as ChronoQuestion).targetDuration;
                              if (isNaN(measured)) return "Pas de réponse";
                              const diff = measured - target;
                              const sign = diff >= 0 ? "+" : "";
                              return `${(measured / 1000).toFixed(3)}s (${sign}${diff}ms)`;
                            })()
                          : isEstimation
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
                          : isJerseyNumber
                          ? (answer.answer ? `N°${answer.answer}` : "Pas de réponse")
                          : answer.answer || "Pas de réponse"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {answer && !answer.isCorrect && (
                      <LaughButton
                        targetPlayerId={score.playerId}
                        roundNumber={roundResult.roundNumber}
                        myPlayerId={myPlayerId}
                      />
                    )}
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
                          <>
                            <LaughButton
                              targetPlayerId={score.playerId}
                              roundNumber={roundResult.roundNumber}
                              myPlayerId={myPlayerId}
                            />
                            <XCircle className="w-4 h-4 text-danger-400/60" />
                          </>
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

// ==========================================
// CHRONO ROUND RESULT
// ==========================================

interface ChronoRoundResultProps {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  players: ReturnType<typeof useRoomStore.getState>["players"];
  myPlayerId: string;
  myResult: { playerId: string; points: number; total: number } | undefined;
  isCorrect: boolean;
}

function ChronoRoundResult({
  roundResult,
  players,
  myPlayerId,
  myResult,
  isCorrect,
}: ChronoRoundResultProps) {
  const q = roundResult.question as ChronoQuestion;
  const sortedScores = [...roundResult.scores].sort((a, b) => b.points - a.points);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-6 pt-6"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-700 flex items-center justify-center">
            <span className="text-2xl">⏱️</span>
          </div>
          <div className="text-left">
            <h2
              className={cn(
                "text-lg font-display font-bold",
                isCorrect ? "text-success-400" : "text-danger-400"
              )}
            >
              {isCorrect ? "Bien chronométré !" : "Pas facile !"}
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

        <Card className="inline-block">
          <p className="text-sm text-surface-400">Cible</p>
          <p className="text-2xl font-display font-bold text-orange-400">
            {(q.targetDuration / 1000).toFixed(3)}s
          </p>
        </Card>
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
                Le plus précis !
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Player results */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex-1 space-y-2"
      >
        {sortedScores.map((score, index) => {
          const player = players.find((p) => p.id === score.playerId);
          if (!player) return null;

          const answer = roundResult.answers.find((a) => a.playerId === score.playerId);
          const measured = answer ? parseInt(answer.answer, 10) : NaN;
          const diff = !isNaN(measured) ? measured - q.targetDuration : null;

          return (
            <motion.div
              key={score.playerId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                "bg-surface-900 border border-surface-800",
                score.playerId === myPlayerId && "border-brand-500/40"
              )}
            >
              {index === 0 && score.points > 0 && (
                <span className="text-lg">🏆</span>
              )}
              <Avatar emoji={player.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-surface-100 truncate block">
                  {player.name}
                </span>
                {!isNaN(measured) ? (
                  <span className={cn(
                    "text-sm",
                    answer?.isCorrect ? "text-success-400" : "text-surface-500"
                  )}>
                    {(measured / 1000).toFixed(3)}s
                    {diff !== null && (
                      <span className="ml-1 text-xs">
                        ({diff >= 0 ? "+" : ""}{diff}ms)
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-surface-600">Pas de réponse</span>
                )}
              </div>
              <span
                className={cn(
                  "font-display font-bold",
                  score.points > 0 ? "text-success-400" : "text-surface-500"
                )}
              >
                +{score.points}
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// CONSENSUS ROUND RESULT
// ==========================================

interface ConsensusRoundResultProps {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  players: ReturnType<typeof useRoomStore.getState>["players"];
  myPlayerId: string;
  myResult: { playerId: string; points: number; total: number } | undefined;
  isCorrect: boolean;
}

function ConsensusRoundResult({
  roundResult,
  players,
  myPlayerId,
  myResult,
  isCorrect,
}: ConsensusRoundResultProps) {
  // Group answers
  const answerGroups = useMemo(() => {
    const groups = new Map<string, { rawAnswer: string; playerIds: string[]; isWinning: boolean }>();

    for (const answer of roundResult.answers) {
      const normalized = answer.answer
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (!normalized) continue;

      if (!groups.has(normalized)) {
        groups.set(normalized, { rawAnswer: answer.answer.trim(), playerIds: [], isWinning: false });
      }
      groups.get(normalized)!.playerIds.push(answer.playerId);
    }

    // Find max group size
    let maxSize = 0;
    for (const [, group] of groups) {
      if (group.playerIds.length > maxSize) maxSize = group.playerIds.length;
    }

    // Mark winners
    for (const [, group] of groups) {
      if (group.playerIds.length === maxSize && maxSize > 0) {
        group.isWinning = true;
      }
    }

    // Sort: winning first, then by size desc
    return Array.from(groups.values()).sort((a, b) => {
      if (a.isWinning !== b.isWinning) return a.isWinning ? -1 : 1;
      return b.playerIds.length - a.playerIds.length;
    });
  }, [roundResult.answers]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-6 pt-6"
      >
        <div className={cn(
          "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3",
          isCorrect ? "bg-success-500" : "bg-danger-500"
        )}>
          {isCorrect ? (
            <CheckCircle className="w-8 h-8 text-white" />
          ) : (
            <XCircle className="w-8 h-8 text-white" />
          )}
        </div>
        <h2
          className={cn(
            "text-xl font-display font-bold",
            isCorrect ? "text-success-400" : "text-danger-400"
          )}
        >
          {isCorrect ? "Dans le consensus !" : "Pas dans la majorité !"}
        </h2>
        {myResult && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <Zap className="w-4 h-4 text-accent-400" />
            <span className="text-base font-display font-bold text-surface-100">
              +{myResult.points} pts
            </span>
          </div>
        )}
      </motion.div>

      {/* Answer groups */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 overflow-y-auto space-y-3"
      >
        {answerGroups.map((group, groupIdx) => (
          <motion.div
            key={groupIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + groupIdx * 0.1 }}
            className={cn(
              "rounded-xl overflow-hidden border",
              group.isWinning
                ? "bg-success-500/10 border-success-500/30"
                : "bg-surface-900 border-surface-800"
            )}
          >
            {/* Group header */}
            <div className={cn(
              "flex items-center gap-2 px-4 py-2.5",
              group.isWinning ? "bg-success-500/10" : "bg-surface-800/50"
            )}>
              {group.isWinning && <span className="text-lg">🏆</span>}
              <span className={cn(
                "font-display font-bold text-lg",
                group.isWinning ? "text-success-400" : "text-surface-300"
              )}>
                &ldquo;{group.rawAnswer}&rdquo;
              </span>
              <span className="text-xs text-surface-500 ml-auto">
                {group.playerIds.length} joueur{group.playerIds.length > 1 ? "s" : ""}
              </span>
              {group.isWinning && (
                <Badge variant="success" size="sm">
                  Gagnant !
                </Badge>
              )}
            </div>

            {/* Players in this group */}
            <div className="divide-y divide-surface-800/50">
              {group.playerIds.map((pid) => {
                const player = players.find((p) => p.id === pid);
                const score = roundResult.scores.find((s) => s.playerId === pid);
                if (!player) return null;

                return (
                  <div
                    key={pid}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2",
                      pid === myPlayerId && "bg-brand-500/5"
                    )}
                  >
                    <Avatar emoji={player.avatar} size="sm" />
                    <span className="text-sm text-surface-300 flex-1">
                      {player.name}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-display font-bold",
                        (score?.points ?? 0) > 0 ? "text-success-400" : "text-surface-500"
                      )}
                    >
                      +{score?.points ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* Players who didn't answer */}
        {(() => {
          const answeredIds = new Set(roundResult.answers.map((a) => a.playerId));
          const noAnswer = players.filter((p) => !answeredIds.has(p.id));
          if (noAnswer.length === 0) return null;

          return (
            <div className="rounded-xl bg-surface-900 border border-surface-800 overflow-hidden">
              <div className="px-4 py-2 bg-surface-800/50">
                <span className="text-xs text-surface-500">Pas de réponse</span>
              </div>
              <div className="divide-y divide-surface-800/50">
                {noAnswer.map((player) => (
                  <div key={player.id} className="flex items-center gap-2 px-4 py-2">
                    <Avatar emoji={player.avatar} size="sm" />
                    <span className="text-sm text-surface-500">{player.name}</span>
                    <span className="text-sm font-display font-bold text-surface-500 ml-auto">+0</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </motion.div>
    </motion.div>
  );
}
