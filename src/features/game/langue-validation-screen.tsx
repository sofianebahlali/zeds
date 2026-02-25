"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { Button, Card, Avatar } from "@/components/ui";
import { useGameStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function LangueValidationScreen() {
  const validationData = useGameStore((s) => s.langueValidationData);
  const answerResults = useGameStore((s) => s.langueAnswerResults);
  const isHost = usePlayerStore((s) => s.isHost);
  const { validateLangueAnswer } = useSocket();

  // Build the review queue: only players who actually answered
  const reviewQueue = useMemo(() => {
    if (!validationData) return [];
    return validationData.playerAnswers.filter(
      (pa) => (pa.languageAnswer || "").trim().length > 0 || (pa.meaningAnswer || "").trim().length > 0
    );
  }, [validationData]);

  const currentIndex = answerResults.length;
  const currentPlayer = currentIndex < reviewQueue.length ? reviewQueue[currentIndex] : null;
  const allReviewed = currentIndex >= reviewQueue.length;

  if (!validationData) return null;

  // ==========================================
  // HOST VIEW: step through answers one by one
  // ==========================================
  if (isHost) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col h-full px-5 pb-4"
      >
        {/* Header: word + correct answers */}
        <div className="text-center mb-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
            <span className="text-lg">🗣️</span>
            <span className="text-xs font-medium text-surface-300">Validation</span>
          </div>
          <div className="flex justify-center mb-2">
            <div className="px-6 py-3 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700">
              <span className="text-2xl font-display font-bold text-white">{validationData.word}</span>
            </div>
          </div>
          <p className="text-surface-400 text-xs">
            {validationData.correctLanguage} &mdash; {validationData.correctMeaning}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {reviewQueue.map((_, i) => {
            const result = answerResults[i];
            let dotColor = "bg-surface-700";
            if (result) {
              if (result.languageCorrect && result.meaningCorrect) dotColor = "bg-success-400";
              else if (result.languageCorrect || result.meaningCorrect) dotColor = "bg-amber-400";
              else dotColor = "bg-danger-400";
            } else if (i === currentIndex) {
              dotColor = "bg-rose-400";
            }
            return <div key={i} className={cn("w-2.5 h-2.5 rounded-full transition-colors", dotColor)} />;
          })}
        </div>

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
                {/* Player info */}
                <Card className="mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar emoji={currentPlayer.playerAvatar} size="md" />
                    <div className="flex-1">
                      <p className="font-medium text-surface-100">
                        {currentPlayer.playerName}
                      </p>
                      <p className="text-xs text-surface-500">
                        Joueur {currentIndex + 1}/{reviewQueue.length}
                      </p>
                    </div>
                  </div>

                  {/* Two answer fields */}
                  <div className="space-y-3">
                    <div className="py-3 px-4 rounded-xl bg-surface-800 border border-surface-700">
                      <p className="text-xs text-surface-500 mb-1">Langue</p>
                      <p className="text-lg font-display font-bold text-surface-100">
                        {currentPlayer.languageAnswer || "(vide)"}
                      </p>
                    </div>
                    <div className="py-3 px-4 rounded-xl bg-surface-800 border border-surface-700">
                      <p className="text-xs text-surface-500 mb-1">Signification</p>
                      <p className="text-lg font-display font-bold text-surface-100">
                        {currentPlayer.meaningAnswer || "(vide)"}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* 4-button grid */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => validateLangueAnswer(currentPlayer.playerId, true, true)}
                    className="!border-success-500/40 !bg-success-500/10 hover:!bg-success-500/20"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-success-400 text-sm font-bold">Les deux</span>
                      <span className="text-success-400/70 text-xs">+200 pts</span>
                    </div>
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => validateLangueAnswer(currentPlayer.playerId, true, false)}
                    className="!border-amber-500/40 !bg-amber-500/10 hover:!bg-amber-500/20"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-amber-400 text-sm font-bold">Langue seule</span>
                      <span className="text-amber-400/70 text-xs">+100 pts</span>
                    </div>
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => validateLangueAnswer(currentPlayer.playerId, false, true)}
                    className="!border-amber-500/40 !bg-amber-500/10 hover:!bg-amber-500/20"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-amber-400 text-sm font-bold">Sens seul</span>
                      <span className="text-amber-400/70 text-xs">+100 pts</span>
                    </div>
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => validateLangueAnswer(currentPlayer.playerId, false, false)}
                    className="!border-danger-500/40 !bg-danger-500/10 hover:!bg-danger-500/20"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-danger-400 text-sm font-bold">Aucun</span>
                      <span className="text-danger-400/70 text-xs">0 pts</span>
                    </div>
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
                  Toutes les réponses validées !
                </p>
                <p className="text-surface-400 text-sm mb-6">
                  Calcul des scores en cours...
                </p>

                {/* Results recap */}
                <div className="w-full space-y-2">
                  {answerResults.map((result) => (
                    <div
                      key={result.playerId}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-xl border",
                        result.languageCorrect && result.meaningCorrect
                          ? "border-success-500/30 bg-success-500/5"
                          : result.languageCorrect || result.meaningCorrect
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-danger-500/30 bg-danger-500/5"
                      )}
                    >
                      <Avatar emoji={result.playerAvatar} size="sm" />
                      <span className="text-sm text-surface-100 flex-1">
                        {result.playerName}
                      </span>
                      <div className="flex gap-1">
                        {result.languageCorrect ? (
                          <CheckCircle className="w-4 h-4 text-success-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-danger-400" />
                        )}
                        {result.meaningCorrect ? (
                          <CheckCircle className="w-4 h-4 text-success-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-danger-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // ==========================================
  // NON-HOST VIEW: see answers revealed one by one
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <span className="text-lg">🗣️</span>
          <span className="text-xs font-medium text-surface-300">Validation</span>
        </div>

        <div className="flex justify-center mb-2">
          <div className="px-6 py-3 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700">
            <span className="text-2xl font-display font-bold text-white">{validationData.word}</span>
          </div>
        </div>

        <p className="text-surface-400 text-xs">
          {validationData.correctLanguage} &mdash; {validationData.correctMeaning}
        </p>
      </div>

      {/* Progress dots */}
      {reviewQueue.length > 0 && (
        <div className="flex justify-center gap-1.5 mb-6">
          {reviewQueue.map((_, i) => {
            const result = answerResults[i];
            let dotColor = "bg-surface-700";
            if (result) {
              if (result.languageCorrect && result.meaningCorrect) dotColor = "bg-success-400";
              else if (result.languageCorrect || result.meaningCorrect) dotColor = "bg-amber-400";
              else dotColor = "bg-danger-400";
            }
            return <div key={i} className={cn("w-2.5 h-2.5 rounded-full transition-colors", dotColor)} />;
          })}
        </div>
      )}

      {/* Show latest validated answer or waiting state */}
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
                    className="flex gap-1"
                  >
                    {latestResult.languageCorrect ? (
                      <CheckCircle className="w-7 h-7 text-success-400" />
                    ) : (
                      <XCircle className="w-7 h-7 text-danger-400" />
                    )}
                    {latestResult.meaningCorrect ? (
                      <CheckCircle className="w-7 h-7 text-success-400" />
                    ) : (
                      <XCircle className="w-7 h-7 text-danger-400" />
                    )}
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <div
                    className={cn(
                      "text-center py-3 px-4 rounded-xl border",
                      latestResult.languageCorrect
                        ? "bg-success-500/5 border-success-500/30"
                        : "bg-danger-500/5 border-danger-500/30"
                    )}
                  >
                    <p className="text-xs text-surface-500 mb-1">Langue</p>
                    <p className="text-lg font-display font-bold text-surface-100">
                      {latestResult.languageAnswer || "(vide)"}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "text-center py-3 px-4 rounded-xl border",
                      latestResult.meaningCorrect
                        ? "bg-success-500/5 border-success-500/30"
                        : "bg-danger-500/5 border-danger-500/30"
                    )}
                  >
                    <p className="text-xs text-surface-500 mb-1">Signification</p>
                    <p className="text-lg font-display font-bold text-surface-100">
                      {latestResult.meaningAnswer || "(vide)"}
                    </p>
                  </div>
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
                <Clock className="w-10 h-10 text-rose-400" />
              </motion.div>
              <p className="text-surface-400">
                L&apos;hôte valide les réponses...
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
                result.languageCorrect && result.meaningCorrect
                  ? "border-success-500/20 bg-success-500/5"
                  : result.languageCorrect || result.meaningCorrect
                  ? "border-amber-500/20 bg-amber-500/5"
                  : "border-danger-500/20 bg-danger-500/5"
              )}
            >
              <Avatar emoji={result.playerAvatar} size="sm" />
              <span className="text-xs text-surface-300 flex-1 truncate">
                {result.playerName}
              </span>
              <div className="flex gap-0.5">
                {result.languageCorrect ? (
                  <CheckCircle className="w-4 h-4 text-success-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-danger-400 shrink-0" />
                )}
                {result.meaningCorrect ? (
                  <CheckCircle className="w-4 h-4 text-success-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-danger-400 shrink-0" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
