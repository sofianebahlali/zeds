"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Send, Clock } from "lucide-react";
import { Button, Card, Avatar, Badge } from "@/components/ui";
import { useGameStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, string> = {
  "Prénom": "👤",
  "Pokémon": "⚡",
  "Joueur de foot": "⚽",
  "Plat": "🍽️",
  "Métier": "💼",
  "Fruit/Légume": "🍎",
  "Film": "🎬",
  "Partie du corps/os": "🦴",
};

export function PetitBacValidationScreen() {
  const validationData = useGameStore((s) => s.petitBacValidationData);
  const isHost = usePlayerStore((s) => s.isHost);
  const { submitPetitBacValidation, socket } = useSocket();
  const myPlayerId = `player_${socket.id}`;

  // Track validated answers: category -> Set of playerIds
  const [validatedMap, setValidatedMap] = useState<Record<string, Set<string>>>(() => {
    if (!validationData) return {};
    const initial: Record<string, Set<string>> = {};
    for (const category of validationData.categories) {
      const validPlayers = new Set<string>();
      for (const pa of validationData.playerAnswers) {
        const answer = (pa.answers[category] || "").trim();
        // Auto-validate if answer starts with the correct letter and is non-empty
        if (
          answer.length > 0 &&
          answer[0].toUpperCase() === validationData.letter.toUpperCase()
        ) {
          validPlayers.add(pa.playerId);
        }
      }
      initial[category] = validPlayers;
    }
    return initial;
  });

  if (!validationData) return null;

  const toggleValidation = (category: string, playerId: string) => {
    setValidatedMap((prev) => {
      const newMap = { ...prev };
      const set = new Set(newMap[category] || []);
      if (set.has(playerId)) {
        set.delete(playerId);
      } else {
        set.add(playerId);
      }
      newMap[category] = set;
      return newMap;
    });
  };

  const handleSubmit = () => {
    const validatedAnswers: Record<string, string[]> = {};
    for (const [category, playerSet] of Object.entries(validatedMap)) {
      validatedAnswers[category] = Array.from(playerSet);
    }
    submitPetitBacValidation({ validatedAnswers });
  };

  // Non-host: waiting screen
  if (!isHost) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center justify-center h-full px-5"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="mb-6"
        >
          <Clock className="w-12 h-12 text-cyan-400" />
        </motion.div>
        <h2 className="text-xl font-display font-bold text-surface-100 mb-2">
          Validation en cours
        </h2>
        <p className="text-surface-400 text-center">
          L&apos;hôte vérifie les réponses...
        </p>

        {/* Show own answers */}
        <div className="mt-8 w-full max-w-sm">
          <Card>
            <h3 className="text-sm font-medium text-surface-400 mb-3">
              Tes réponses — Lettre{" "}
              <span className="text-cyan-400 font-bold">{validationData.letter}</span>
            </h3>
            <div className="space-y-2">
              {validationData.categories.map((category) => {
                const myData = validationData.playerAnswers.find(
                  (pa) => pa.playerId === myPlayerId
                );
                const answer = myData?.answers[category] || "";
                return (
                  <div key={category} className="flex items-center gap-2">
                    <span className="text-sm shrink-0">
                      {CATEGORY_ICONS[category] || "📝"}
                    </span>
                    <span className="text-xs text-surface-400 w-28 shrink-0 truncate">
                      {category}
                    </span>
                    <span
                      className={cn(
                        "text-sm flex-1 truncate",
                        answer ? "text-surface-100" : "text-surface-600 italic"
                      )}
                    >
                      {answer || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </motion.div>
    );
  }

  // Host: validation UI
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Header */}
      <div className="text-center mb-4 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <span className="text-lg">🔤</span>
          <span className="text-xs font-medium text-surface-300">Validation</span>
        </div>
        <div className="flex justify-center mb-2">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
            <span className="text-2xl font-display font-black text-white">
              {validationData.letter}
            </span>
          </div>
        </div>
        <p className="text-surface-400 text-xs">
          Valide ou rejette les réponses de chaque joueur
        </p>
      </div>

      {/* Categories with answers */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-4">
        {validationData.categories.map((category, catIndex) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: catIndex * 0.05 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">
                {CATEGORY_ICONS[category] || "📝"}
              </span>
              <span className="text-sm font-medium text-surface-200">
                {category}
              </span>
            </div>

            <div className="space-y-1.5">
              {validationData.playerAnswers.map((pa) => {
                const answer = (pa.answers[category] || "").trim();
                const isValidated = validatedMap[category]?.has(pa.playerId) || false;
                const startsWithLetter =
                  answer.length > 0 &&
                  answer[0].toUpperCase() === validationData.letter.toUpperCase();

                return (
                  <button
                    key={pa.playerId}
                    onClick={() => toggleValidation(category, pa.playerId)}
                    disabled={!answer}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                      "border",
                      !answer
                        ? "border-surface-800 bg-surface-900/50 opacity-40 cursor-default"
                        : isValidated
                        ? "border-success-500/40 bg-success-500/5"
                        : "border-danger-500/40 bg-danger-500/5"
                    )}
                  >
                    <Avatar emoji={pa.playerAvatar} size="sm" />
                    <span className="text-xs text-surface-400 w-16 truncate shrink-0">
                      {pa.playerName}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm truncate",
                        answer ? "text-surface-100" : "text-surface-600 italic",
                        !startsWithLetter && answer && "text-danger-400"
                      )}
                    >
                      {answer || "—"}
                    </span>
                    {answer && (
                      <span className="shrink-0">
                        {isValidated ? (
                          <CheckCircle className="w-5 h-5 text-success-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-danger-400" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Submit button */}
      <div className="mt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          rightIcon={<Send className="w-5 h-5" />}
        >
          Valider les résultats
        </Button>
      </div>
    </motion.div>
  );
}
