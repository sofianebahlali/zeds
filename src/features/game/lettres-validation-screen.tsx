"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button, Card, Avatar } from "@/components/ui";
import { useGameStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function LettresValidationScreen() {
  const validationData = useGameStore((s) => s.lettresValidationData);
  const answerResults = useGameStore((s) => s.lettresAnswerResults);
  const isHost = usePlayerStore((s) => s.isHost);
  const { validateLettresAnswer } = useSocket();

  // Review queue: sorted by word length ascending (already sorted by server)
  const reviewQueue = useMemo(() => {
    if (!validationData) return [];
    return validationData.playerAnswers;
  }, [validationData]);

  const currentIndex = answerResults.length;
  const currentPlayer = currentIndex < reviewQueue.length ? reviewQueue[currentIndex] : null;
  const allReviewed = currentIndex >= reviewQueue.length;

  if (!validationData) return null;

  const letters = validationData.letters;

  // ==========================================
  // HOST VIEW: review words one by one (ascending length order)
  // ==========================================
  if (isHost) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col min-h-full px-5 pb-4"
      >
        {/* Header */}
        <div className="text-center mb-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
            <span className="text-lg">🔠</span>
            <span className="text-xs font-medium text-surface-300">Validation</span>
          </div>

          {/* Letters reminder */}
          <div className="flex justify-center gap-1.5 mb-2">
            {letters.map((letter, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-display font-bold bg-blue-500/15 border border-blue-400/30 text-blue-300"
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {reviewQueue.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                i < currentIndex
                  ? answerResults[i]?.accepted
                    ? "bg-success-400"
                    : "bg-danger-400"
                  : i === currentIndex
                  ? "bg-brand-400"
                  : "bg-surface-700"
              )}
            />
          ))}
        </div>

        {/* All submitted words summary */}
        {!allReviewed && (
          <div className="mb-4 p-3 rounded-xl bg-surface-800/50 border border-surface-700">
            <p className="text-xs font-medium text-surface-400 mb-2">Mots soumis (du + court au + long)</p>
            <div className="space-y-1.5">
              {reviewQueue.map((pa, i) => {
                const isCurrent = i === currentIndex;
                const isReviewed = i < currentIndex;
                const result = isReviewed ? answerResults[i] : null;
                return (
                  <div
                    key={pa.playerId}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-colors",
                      isCurrent
                        ? "bg-brand-500/20 border-brand-500/40"
                        : isReviewed
                        ? result?.accepted
                          ? "bg-success-500/10 border-success-500/20"
                          : "bg-danger-500/10 border-danger-500/20"
                        : "bg-surface-700/50 border-surface-600"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar emoji={pa.playerAvatar} size="sm" />
                      <span className="text-sm text-surface-300">{pa.playerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-display font-bold",
                        isCurrent ? "text-brand-300" :
                        isReviewed ? (result?.accepted ? "text-success-300" : "text-danger-300 line-through") :
                        "text-surface-500"
                      )}>
                        {isReviewed || isCurrent ? pa.word : `${pa.wordLength} lettres`}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-700 text-surface-400 font-bold">
                        {pa.wordLength}
                      </span>
                      {isReviewed && (
                        result?.accepted
                          ? <CheckCircle className="w-4 h-4 text-success-400" />
                          : <XCircle className="w-4 h-4 text-danger-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current answer being reviewed */}
        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {currentPlayer && !allReviewed ? (
              <motion.div
                key={currentPlayer.playerId}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col"
              >
                <Card className="mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar emoji={currentPlayer.playerAvatar} size="md" />
                    <div className="flex-1">
                      <p className="font-medium text-surface-100">
                        {currentPlayer.playerName}
                      </p>
                      <p className="text-xs text-surface-500">
                        Mot {currentIndex + 1}/{reviewQueue.length}
                      </p>
                    </div>
                  </div>

                  <div className="text-center py-6 px-4 rounded-xl bg-surface-800 border border-surface-700">
                    <p className="text-xs text-surface-500 mb-2">Son mot</p>
                    <p className="text-3xl font-display font-bold text-surface-100 tracking-widest">
                      {currentPlayer.word}
                    </p>
                    <p className="text-sm text-brand-400 font-bold mt-2">
                      {currentPlayer.wordLength} lettres
                    </p>
                  </div>
                </Card>

                {/* Accept / Reject buttons */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => validateLettresAnswer(currentPlayer.playerId, false)}
                    className="!border-danger-500/40 !bg-danger-500/10 hover:!bg-danger-500/20"
                    leftIcon={<ThumbsDown className="w-5 h-5 text-danger-400" />}
                  >
                    <span className="text-danger-400">Refuser</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => validateLettresAnswer(currentPlayer.playerId, true)}
                    className="!border-success-500/40 !bg-success-500/10 hover:!bg-success-500/20"
                    leftIcon={<ThumbsUp className="w-5 h-5 text-success-400" />}
                  >
                    <span className="text-success-400">Accepter</span>
                  </Button>
                </div>
              </motion.div>
            ) : allReviewed ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <CheckCircle className="w-12 h-12 text-success-400 mb-3" />
                <p className="text-lg font-display font-bold text-surface-100 mb-1">
                  Tous les mots validés !
                </p>
                <p className="text-surface-400 text-sm mb-6">
                  Calcul des scores en cours...
                </p>

                <div className="w-full space-y-2">
                  {answerResults.map((result) => (
                    <div
                      key={result.playerId}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl border",
                        result.accepted
                          ? "border-success-500/30 bg-success-500/5"
                          : "border-danger-500/30 bg-danger-500/5"
                      )}
                    >
                      <Avatar emoji={result.playerAvatar} size="sm" />
                      <span className="text-sm text-surface-100 flex-1">
                        {result.playerName}
                      </span>
                      <span className={cn(
                        "text-sm font-display font-bold",
                        result.accepted ? "text-success-300" : "text-danger-300 line-through"
                      )}>
                        {result.word}
                      </span>
                      {result.accepted ? (
                        <CheckCircle className="w-5 h-5 text-success-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-danger-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : reviewQueue.length === 0 ? (
              <motion.div
                key="no-answers"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <p className="text-surface-400 text-sm">
                  Aucun mot soumis...
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // ==========================================
  // NON-HOST VIEW: see words revealed one by one
  // ==========================================
  const latestResult = answerResults.length > 0
    ? answerResults[answerResults.length - 1]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full px-5"
    >
      {/* Header */}
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
          <span className="text-lg">🔠</span>
          <span className="text-xs font-medium text-surface-300">Validation</span>
        </div>

        {/* Letters reminder */}
        <div className="flex justify-center gap-1.5 mb-2">
          {letters.map((letter, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-display font-bold bg-blue-500/15 border border-blue-400/30 text-blue-300"
            >
              {letter}
            </div>
          ))}
        </div>
      </div>

      {/* Progress dots */}
      {reviewQueue.length > 0 && (
        <div className="flex justify-center gap-1.5 mb-6">
          {reviewQueue.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                i < answerResults.length
                  ? answerResults[i]?.accepted
                    ? "bg-success-400"
                    : "bg-danger-400"
                  : "bg-surface-700"
              )}
            />
          ))}
        </div>
      )}

      {/* Show latest validated word or waiting state */}
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {latestResult ? (
            <motion.div
              key={latestResult.playerId}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <Card>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar emoji={latestResult.playerAvatar} size="md" />
                  <div className="flex-1">
                    <p className="font-medium text-surface-100">
                      {latestResult.playerName}
                    </p>
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.2 }}
                  >
                    {latestResult.accepted ? (
                      <CheckCircle className="w-8 h-8 text-success-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-danger-400" />
                    )}
                  </motion.div>
                </div>

                <div
                  className={cn(
                    "text-center py-4 px-4 rounded-xl border",
                    latestResult.accepted
                      ? "bg-success-500/5 border-success-500/30"
                      : "bg-danger-500/5 border-danger-500/30"
                  )}
                >
                  <p className="text-xs text-surface-500 mb-1">Son mot</p>
                  <p className="text-2xl font-display font-bold text-surface-100 tracking-widest">
                    {latestResult.word}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-medium mt-2",
                      latestResult.accepted ? "text-success-400" : "text-danger-400"
                    )}
                  >
                    {latestResult.accepted
                      ? `Accepté ! (${latestResult.word.length} lettres)`
                      : "Refusé"}
                  </p>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="mb-4 inline-block"
              >
                <Clock className="w-10 h-10 text-brand-400" />
              </motion.div>
              <p className="text-surface-400">
                L&apos;hôte valide les mots...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Previous results summary */}
      {answerResults.length > 1 && (
        <div className="mt-6 w-full max-w-sm space-y-1.5">
          {answerResults.slice(0, -1).map((result) => (
            <motion.div
              key={result.playerId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border",
                result.accepted
                  ? "border-success-500/20 bg-success-500/5"
                  : "border-danger-500/20 bg-danger-500/5"
              )}
            >
              <Avatar emoji={result.playerAvatar} size="sm" />
              <span className="text-xs text-surface-300 flex-1 truncate">
                {result.playerName}
              </span>
              <span className={cn(
                "text-xs font-display font-bold",
                result.accepted ? "text-success-300" : "text-danger-300 line-through"
              )}>
                {result.word}
              </span>
              {result.accepted ? (
                <CheckCircle className="w-4 h-4 text-success-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-danger-400 shrink-0" />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
