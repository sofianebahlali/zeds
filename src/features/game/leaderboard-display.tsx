"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, Award } from "lucide-react";
import { Card, Avatar, Progress } from "@/components/ui";
import { useRoomStore, useGameStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";

export function LeaderboardDisplay() {
  const players = useRoomStore((s) => s.players);
  const currentRound = useGameStore((s) => s.currentRound);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const { socket } = useSocket();

  const myPlayerId = `player_${socket.id}`;
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const maxScore = sortedPlayers[0]?.score || 1;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-accent-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-surface-300" />;
      case 3:
        return <Award className="w-6 h-6 text-brand-400" />;
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-surface-500 font-display font-bold">
            {rank}
          </span>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 pt-8"
      >
        <h2 className="text-3xl font-display font-bold text-surface-100 mb-2">Classement</h2>
        <p className="text-surface-400">
          Après {currentRound} / {totalRounds} manches
        </p>
      </motion.div>

      {/* Leaderboard */}
      <div className="flex-1 space-y-2 overflow-auto">
        {sortedPlayers.map((player, index) => {
          const rank = index + 1;
          const isMe = player.id === myPlayerId;
          const scorePercentage = (player.score / maxScore) * 100;

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative overflow-hidden rounded-xl",
                "border",
                "bg-surface-900",
                rank === 1 ? "border-accent-500/40" : "border-surface-800",
                isMe && "border-brand-500/40"
              )}
            >
              {/* Score bar background */}
              <motion.div
                className="absolute inset-0 bg-surface-800/50"
                initial={{ width: 0 }}
                animate={{ width: `${scorePercentage}%` }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              />

              {/* Content */}
              <div className="relative flex items-center gap-4 p-4">
                <div className="shrink-0">{getRankIcon(rank)}</div>
                <Avatar emoji={player.avatar} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-surface-100 truncate">
                      {player.name}
                    </span>
                    {isMe && (
                      <span className="text-xs text-surface-500">(toi)</span>
                    )}
                  </div>
                  {player.streak >= 3 && (
                    <span className="text-xs text-accent-400">
                      Série de {player.streak}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-2xl font-display font-bold text-surface-100">
                    {player.score}
                  </span>
                  <span className="text-surface-500 text-sm ml-1">pts</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Next round indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 text-center"
      >
        <p className="text-surface-500 text-sm">
          Prochaine question dans quelques secondes...
        </p>
        <div className="mt-2">
          <Progress value={100} variant="brand" size="sm" animated />
        </div>
      </motion.div>
    </motion.div>
  );
}
