"use client";

import { motion } from "framer-motion";
import { Check, X, Clock, Vote, Users } from "lucide-react";
import { Card, Avatar, Button, Progress } from "@/components/ui";
import { useGameStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function VotingPhase() {
  const votingData = useGameStore((s) => s.votingData);
  const votingTimeRemaining = useGameStore((s) => s.votingTimeRemaining);
  const myVotes = useGameStore((s) => s.myVotes);
  const votedPlayers = useGameStore((s) => s.votedPlayers);
  const { socket, submitVote } = useSocket();

  if (!votingData) return null;

  const myPlayerId = `player_${socket.id}`;
  const totalVotingTime = votingData.totalVotingTime;
  const progressPercent = (votingTimeRemaining / totalVotingTime) * 100;

  // Filter out my own answer from voting
  const answersToVote = votingData.answersToVote.filter(
    (a) => a.playerId !== myPlayerId
  );

  // Check if I submitted an answer (if not, I can vote on all)
  const myAnswer = votingData.answersToVote.find((a) => a.playerId === myPlayerId);

  const handleVote = (targetPlayerId: string, isValid: boolean) => {
    submitVote(targetPlayerId, isValid);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-4 pb-4"
    >
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-6 pt-4"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Vote className="w-6 h-6 text-accent-400" />
          <h2 className="text-xl font-bold text-white">Phase de vote</h2>
        </div>
        <p className="text-sm text-surface-400">
          Votez pour valider ou refuser chaque réponse
        </p>
      </motion.div>

      {/* Timer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-surface-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Temps restant</span>
          </div>
          <span className={cn(
            "font-bold",
            votingTimeRemaining <= 5 ? "text-danger-400" : "text-white"
          )}>
            {votingTimeRemaining}s
          </span>
        </div>
        <Progress
          value={progressPercent}
          variant={votingTimeRemaining <= 5 ? "danger" : "accent"}
          size="sm"
          animated
        />
      </motion.div>

      {/* Correct answer reference */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card variant="gradient" gradient="from-brand-500/20 to-brand-600/20" className="mb-6">
          <div className="text-center">
            <p className="text-sm text-surface-400 mb-1">Réponse attendue :</p>
            <p className="text-xl font-bold text-brand-400">
              {votingData.correctAnswer}
            </p>
          </div>
        </Card>
      </motion.div>

      {/* My answer if I submitted one */}
      {myAnswer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <p className="text-xs text-surface-500 mb-2">Ta réponse :</p>
          <Card variant="glass" className="bg-surface-800/50">
            <div className="flex items-center gap-3">
              <Avatar emoji={myAnswer.playerAvatar} size="sm" />
              <div className="flex-1">
                <span className="font-medium text-white">{myAnswer.playerName}</span>
                <p className="text-surface-300">{myAnswer.answer}</p>
              </div>
              <span className="text-xs text-surface-500">
                {myAnswer.responseTime.toFixed(1)}s
              </span>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Answers to vote on */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-surface-400" />
          <h3 className="text-sm font-medium text-surface-400">
            Réponses à valider ({answersToVote.length})
          </h3>
        </div>

        {answersToVote.length === 0 ? (
          <Card variant="glass" className="text-center py-8">
            <p className="text-surface-400">
              Aucune réponse à valider
            </p>
            <p className="text-sm text-surface-500 mt-1">
              Attends les résultats des votes
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {answersToVote.map((answer, index) => {
              const hasVoted = answer.playerId in myVotes;
              const myVote = myVotes[answer.playerId];
              const votersCount = votedPlayers[answer.playerId]?.length || 0;

              return (
                <motion.div
                  key={answer.playerId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Card
                    variant="glass"
                    className={cn(
                      "transition-all duration-200",
                      hasVoted && myVote && "ring-2 ring-success-500/50",
                      hasVoted && !myVote && "ring-2 ring-danger-500/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar emoji={answer.playerAvatar} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white truncate">
                            {answer.playerName}
                          </span>
                          <span className="text-xs text-surface-500">
                            {answer.responseTime.toFixed(1)}s
                          </span>
                        </div>
                        <p className="text-lg text-surface-200 mb-3">
                          "{answer.answer}"
                        </p>

                        {/* Vote buttons */}
                        {!hasVoted ? (
                          <div className="flex gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleVote(answer.playerId, true)}
                              className="flex-1"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Valide
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleVote(answer.playerId, false)}
                              className="flex-1"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Refuse
                            </Button>
                          </div>
                        ) : (
                          <div className={cn(
                            "flex items-center justify-center gap-2 py-2 px-3 rounded-lg",
                            myVote
                              ? "bg-success-500/20 text-success-400"
                              : "bg-danger-500/20 text-danger-400"
                          )}>
                            {myVote ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span className="text-sm font-medium">Tu as validé</span>
                              </>
                            ) : (
                              <>
                                <X className="w-4 h-4" />
                                <span className="text-sm font-medium">Tu as refusé</span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Vote count indicator */}
                        {votersCount > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-surface-500">
                            <Users className="w-3 h-3" />
                            <span>{votersCount} vote{votersCount > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
