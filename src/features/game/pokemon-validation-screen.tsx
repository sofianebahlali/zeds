"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import Image from "next/image";
import { Button, Card, Avatar } from "@/components/ui";
import { useGameStore, usePlayerStore, useRoomStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function PokemonValidationScreen() {
  const validationData = useGameStore((s) => s.pokemonValidationData);
  const answerResults = useGameStore((s) => s.pokemonAnswerResults);
  const isHost = usePlayerStore((s) => s.isHost);
  const { validatePokemonAnswer } = useSocket();

  if (!validationData) return null;

  const { nameFr, nameEn, imageUrl, playerAnswers } = validationData;

  // Filter to only players with non-empty answers
  const answersToReview = playerAnswers.filter((p) => p.answer.trim().length > 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-3 py-4 gap-4"
    >
      {/* Revealed Pokemon */}
      <div className="text-center">
        <h2 className="text-base font-display font-bold text-surface-100 mb-2">
          Validation des réponses
        </h2>

        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="relative w-20 h-20">
            <Image
              src={imageUrl}
              alt={nameFr}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="text-left">
            <p className="text-lg font-display font-bold text-surface-100">
              {nameFr}
            </p>
            <p className="text-sm text-surface-500">{nameEn}</p>
          </div>
        </div>
      </div>

      {/* Player answers */}
      <div className="space-y-2 flex-1 overflow-y-auto">
        {answersToReview.length === 0 ? (
          <p className="text-center text-sm text-surface-500">
            Aucune réponse soumise
          </p>
        ) : (
          answersToReview.map((pa) => {
            const result = answerResults.find((r) => r.playerId === pa.playerId);
            const isReviewed = !!result;

            return (
              <Card key={pa.playerId} className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar emoji={pa.playerAvatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-100 truncate">
                      {pa.playerName}
                    </p>
                    <p className="text-sm text-surface-300 truncate">
                      &ldquo;{pa.answer}&rdquo;
                    </p>
                  </div>

                  {isReviewed ? (
                    <div
                      className={cn(
                        "p-1.5 rounded-full",
                        result.accepted
                          ? "bg-lime-500/20 text-lime-400"
                          : "bg-red-500/20 text-red-400"
                      )}
                    >
                      {result.accepted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </div>
                  ) : isHost ? (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-lime-500/30 text-lime-400 hover:bg-lime-500/10 px-2"
                        onClick={() =>
                          validatePokemonAnswer(pa.playerId, true)
                        }
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 px-2"
                        onClick={() =>
                          validatePokemonAnswer(pa.playerId, false)
                        }
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-surface-500">En attente...</span>
                  )}
                </div>
              </Card>
            );
          })
        )}

        {/* Players with no answer */}
        {playerAnswers
          .filter((p) => !p.answer.trim())
          .map((pa) => (
            <Card key={pa.playerId} className="p-3 opacity-50">
              <div className="flex items-center gap-3">
                <Avatar emoji={pa.playerAvatar} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100 truncate">
                    {pa.playerName}
                  </p>
                  <p className="text-xs text-surface-500 italic">
                    Pas de réponse
                  </p>
                </div>
                <div className="p-1.5 rounded-full bg-red-500/20 text-red-400">
                  <X className="w-4 h-4" />
                </div>
              </div>
            </Card>
          ))}
      </div>
    </motion.div>
  );
}
