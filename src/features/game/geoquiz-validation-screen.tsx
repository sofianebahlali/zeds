"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, MapPin, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button, Card, Avatar, Badge } from "@/components/ui";
import { useGameStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function GeoQuizValidationScreen() {
  const validationData = useGameStore((s) => s.geoQuizValidationData);
  const answerResults = useGameStore((s) => s.geoQuizAnswerResults);
  const isHost = usePlayerStore((s) => s.isHost);
  const { validateGeoQuizAnswer } = useSocket();

  // Build the review queue: only players who actually answered
  const reviewQueue = useMemo(() => {
    if (!validationData) return [];
    return validationData.playerAnswers.filter(
      (pa) => (pa.answer || "").trim().length > 0
    );
  }, [validationData]);

  // The current player to review (for host) = number of results received so far
  const currentIndex = answerResults.length;
  const currentPlayer = currentIndex < reviewQueue.length ? reviewQueue[currentIndex] : null;
  const allReviewed = currentIndex >= reviewQueue.length;

  const [imageError, setImageError] = useState(false);

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
        className="flex flex-col min-h-full px-5 pb-4"
      >
        {/* Header: image + correct answer */}
        <div className="text-center mb-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
            <span className="text-lg">🌍</span>
            <span className="text-xs font-medium text-surface-300">Validation</span>
          </div>

          {validationData.imageUrl && (
            <div className="flex justify-center mb-2">
              <div className="w-28 h-20 rounded-xl overflow-hidden bg-surface-800">
              {imageError ? (
                <div className="w-full h-full flex items-center justify-center text-surface-600">
                  <MapPin className="w-5 h-5" />
                </div>
              ) : (
                <img
                  src={validationData.imageUrl}
                  alt="Lieu"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              )}
              </div>
            </div>
          )}

          <div className="flex justify-center mb-1">
            <div className="px-4 py-1.5 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700">
              <span className="text-base font-display font-bold text-white">
                {validationData.city}
              </span>
            </div>
          </div>
          <p className="text-surface-500 text-xs">{validationData.country}</p>
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
                  ? "bg-sky-400"
                  : "bg-surface-700"
              )}
            />
          ))}
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
                    {currentPlayer.usedHint && (
                      <Badge variant="warning" size="sm">Indice</Badge>
                    )}
                  </div>

                  {/* Their answer - big and prominent */}
                  <div className="text-center py-6 px-4 rounded-xl bg-surface-800 border border-surface-700">
                    <p className="text-xs text-surface-500 mb-2">Sa réponse</p>
                    <p className="text-2xl font-display font-bold text-surface-100">
                      {currentPlayer.answer}
                    </p>
                  </div>
                </Card>

                {/* Accept / Reject buttons */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => validateGeoQuizAnswer(currentPlayer.playerId, false)}
                    className="!border-danger-500/40 !bg-danger-500/10 hover:!bg-danger-500/20"
                    leftIcon={<ThumbsDown className="w-5 h-5 text-danger-400" />}
                  >
                    <span className="text-danger-400">Refuser</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    onClick={() => validateGeoQuizAnswer(currentPlayer.playerId, true)}
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
                  Toutes les réponses validées !
                </p>
                <p className="text-surface-400 text-sm mb-6">
                  Calcul des scores en cours...
                </p>

                {/* Results recap */}
                <div className="w-full space-y-2">
                  {answerResults.map((result, i) => (
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
                      <span className="text-sm text-surface-400">{result.answer}</span>
                      {result.accepted ? (
                        <CheckCircle className="w-5 h-5 text-success-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-danger-400 shrink-0" />
                      )}
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
          <span className="text-lg">🌍</span>
          <span className="text-xs font-medium text-surface-300">Validation</span>
        </div>

        {validationData.imageUrl && (
          <div className="flex justify-center mb-2">
            <div className="w-28 h-20 rounded-xl overflow-hidden bg-surface-800">
              {imageError ? (
                <div className="w-full h-full flex items-center justify-center text-surface-600">
                  <MapPin className="w-5 h-5" />
                </div>
              ) : (
                <img
                  src={validationData.imageUrl}
                  alt="Lieu"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          </div>
        )}

        <div className="flex justify-center mb-1">
          <div className="px-4 py-1.5 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700">
            <span className="text-base font-display font-bold text-white">
              {validationData.city}
            </span>
          </div>
        </div>
        <p className="text-surface-500 text-xs">{validationData.country}</p>
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
                    {latestResult.usedHint && (
                      <Badge variant="warning" size="sm">Indice utilisé</Badge>
                    )}
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
                  <p className="text-xs text-surface-500 mb-1">Sa réponse</p>
                  <p className="text-xl font-display font-bold text-surface-100">
                    {latestResult.answer}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-medium mt-2",
                      latestResult.accepted ? "text-success-400" : "text-danger-400"
                    )}
                  >
                    {latestResult.accepted ? "Acceptée !" : "Refusée"}
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
                <Clock className="w-10 h-10 text-sky-400" />
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
                result.accepted
                  ? "border-success-500/20 bg-success-500/5"
                  : "border-danger-500/20 bg-danger-500/5"
              )}
            >
              <Avatar emoji={result.playerAvatar} size="sm" />
              <span className="text-xs text-surface-300 flex-1 truncate">
                {result.playerName}
              </span>
              <span className="text-xs text-surface-500 truncate max-w-[100px]">
                {result.answer}
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
