"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { useGameStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function DrawingRevealScreen() {
  const isHost = usePlayerStore((s) => s.isHost);
  const revealState = useGameStore((s) => s.drawingRevealState);
  const drawingScores = useGameStore((s) => s.drawingScores);
  const { advanceDrawingReveal, retreatDrawingReveal, validateDrawingChain } = useSocket();

  if (!revealState || revealState.chains.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-surface-400">Chargement des résultats...</span>
      </div>
    );
  }

  const currentChain = revealState.chains[revealState.currentChainIndex];
  const step = revealState.currentStep;
  const isLastChain = revealState.currentChainIndex === revealState.chains.length - 1;
  const isLastStep = step === 3;
  const isFirst = revealState.currentChainIndex === 0 && step === 0;

  return (
    <motion.div
      className="flex flex-col h-full px-4 pb-4 pb-safe-bottom"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Chain progress */}
      <div className="flex gap-1 pt-4 mb-4">
        {revealState.chains.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < revealState.currentChainIndex
                ? "bg-brand-500"
                : i === revealState.currentChainIndex
                ? "bg-brand-400"
                : "bg-surface-800"
            )}
          />
        ))}
      </div>

      <div className="text-center mb-2">
        <span className="text-xs text-surface-500">
          Chaîne {revealState.currentChainIndex + 1}/{revealState.chains.length}
        </span>
      </div>

      {/* Reveal content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 overflow-y-auto min-h-0">
        <AnimatePresence mode="wait">
          {/* Step 0: Phrase + Suggester */}
          {step >= 0 && (
            <motion.div
              key={`phrase-${revealState.currentChainIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <Card variant="glass" padding="md" className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-xl">{currentChain.suggesterAvatar}</span>
                  <span className="font-medium text-surface-100">{currentChain.suggesterName}</span>
                  <span className="text-surface-400 text-sm">a suggéré :</span>
                </div>
                <p className="text-lg font-display font-bold text-surface-100">
                  &laquo; {currentChain.phrase} &raquo;
                </p>
              </Card>
            </motion.div>
          )}

          {/* Step 1: Drawing + artist */}
          {step >= 1 && (
            <motion.div
              key={`drawing-${revealState.currentChainIndex}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full"
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-xl">{currentChain.artistAvatar}</span>
                  <span className="font-medium text-surface-100">{currentChain.artistName}</span>
                  <span className="text-surface-400 text-sm">a dessiné :</span>
                </div>
                <div className="w-56 h-56 mx-auto rounded-xl overflow-hidden bg-white shadow-lg">
                  {currentChain.drawingData ? (
                    <img
                      src={currentChain.drawingData}
                      alt="Dessin"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-400 text-sm">
                      Pas de dessin
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Guess */}
          {step >= 2 && (
            <motion.div
              key={`guess-${revealState.currentChainIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <Card variant="glass" padding="md" className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-xl">{currentChain.guesserAvatar}</span>
                  <span className="font-medium text-surface-100">{currentChain.guesserName}</span>
                  <span className="text-surface-400 text-sm">a deviné :</span>
                </div>
                <p className="text-lg font-display font-bold text-surface-100">
                  &laquo; {currentChain.guess || "..."} &raquo;
                </p>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Verdict */}
          {step >= 3 && (
            <motion.div
              key={`verdict-${revealState.currentChainIndex}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex flex-col items-center"
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center",
                currentChain.isGuessCorrect ? "bg-success-500" : "bg-danger-500"
              )}>
                {currentChain.isGuessCorrect
                  ? <CheckCircle className="w-8 h-8 text-white" />
                  : <XCircle className="w-8 h-8 text-white" />}
              </div>
              <p className={cn(
                "text-lg font-display font-bold mt-2",
                currentChain.isGuessCorrect ? "text-success-400" : "text-danger-400"
              )}>
                {currentChain.isGuessCorrect ? "Bien deviné !" : "Raté !"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Score summary (show after all chains are done — on last step of last chain) */}
      {isLastChain && isLastStep && drawingScores && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-3"
        >
          <Card variant="default" padding="sm">
            <p className="text-xs text-surface-400 text-center mb-2">Scores du round</p>
            <div className="space-y-1">
              {drawingScores.scores
                .sort((a, b) => b.points - a.points)
                .map((s) => {
                  const chain = revealState.chains.find(c => c.artistId === s.playerId || c.guesserId === s.playerId || c.suggesterId === s.playerId);
                  const name = chain?.artistId === s.playerId ? chain.artistName : chain?.guesserId === s.playerId ? chain.guesserName : chain?.suggesterName || "???";
                  const avatar = chain?.artistId === s.playerId ? chain.artistAvatar : chain?.guesserId === s.playerId ? chain.guesserAvatar : chain?.suggesterAvatar || "🦊";
                  return (
                    <div key={s.playerId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{avatar}</span>
                        <span className="text-surface-200">{name}</span>
                      </div>
                      <span className={cn(
                        "font-bold",
                        s.points > 0 ? "text-success-400" : "text-surface-500"
                      )}>
                        +{s.points}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Host navigation */}
      {isHost ? (
        step === 2 && currentChain.isGuessCorrect === null ? (
          /* Validation buttons — host must validate before advancing */
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-shrink-0"
              onClick={retreatDrawingReveal}
              disabled={isFirst}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="secondary"
              className="flex-1 !bg-danger-500/20 !text-danger-400 !border-danger-500/30"
              onClick={() => validateDrawingChain(revealState.currentChainIndex, false)}
            >
              <XCircle className="w-5 h-5 mr-1" /> Raté
            </Button>
            <Button
              variant="secondary"
              className="flex-1 !bg-success-500/20 !text-success-400 !border-success-500/30"
              onClick={() => validateDrawingChain(revealState.currentChainIndex, true)}
            >
              <CheckCircle className="w-5 h-5 mr-1" /> Correct
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-shrink-0"
              onClick={retreatDrawingReveal}
              disabled={isFirst}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={advanceDrawingReveal}
            >
              {isLastChain && isLastStep ? "Terminer" : "Suivant"}
              {!(isLastChain && isLastStep) && <ChevronRight className="w-5 h-5" />}
            </Button>
          </div>
        )
      ) : (
        step === 2 && currentChain.isGuessCorrect === null ? (
          <p className="text-center text-surface-500 text-sm py-2">
            L&apos;hôte valide la réponse...
          </p>
        ) : (
          <p className="text-center text-surface-500 text-sm py-2">
            L&apos;hôte contrôle la présentation...
          </p>
        )
      )}
    </motion.div>
  );
}
