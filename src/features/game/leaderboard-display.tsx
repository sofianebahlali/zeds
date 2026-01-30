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
        return <Trophy className="w-6 h-6 text-warning-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-surface-300" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-surface-500 font-bold">
            {rank}
          </span>
        );
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "from-warning-500/20 to-warning-600/20 border-warning-500/30";
      case 2:
        return "from-surface-400/10 to-surface-500/10 border-surface-400/20";
      case 3:
        return "from-amber-600/10 to-amber-700/10 border-amber-600/20";
      default:
        return "from-surface-800 to-surface-900 border-surface-700";
    }
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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 pt-8"
      >
        <h2 className="text-2xl font-bold text-white mb-2">Classement</h2>
        <p className="text-surface-400">
          Après {currentRound} / {totalRounds} manches
        </p>
      </motion.div>

      {/* Leaderboard */}
      <div className="flex-1 space-y-3 overflow-auto">
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
                "relative overflow-hidden rounded-2xl",
                "border",
                "bg-gradient-to-r",
                getRankColor(rank),
                isMe && "ring-2 ring-brand-500"
              )}
            >
              {/* Score bar background */}
              <motion.div
                className="absolute inset-0 bg-white/5"
                initial={{ width: 0 }}
                animate={{ width: `${scorePercentage}%` }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
              />

              {/* Content */}
              <div className="relative flex items-center gap-4 p-4">
                {/* Rank */}
                <div className="shrink-0">{getRankIcon(rank)}</div>

                {/* Avatar */}
                <Avatar emoji={player.avatar} size="md" />

                {/* Name and score */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">
                      {player.name}
                    </span>
                    {isMe && (
                      <span className="text-xs text-surface-500">(toi)</span>
                    )}
                  </div>
                  {player.streak >= 3 && (
                    <span className="text-xs text-warning-400">
                      🔥 Série de {player.streak}
                    </span>
                  )}
                </div>

                {/* Score */}
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">
                    {player.score}
                  </span>
                  <span className="text-surface-400 text-sm ml-1">pts</span>
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
        <p className="text-surface-400 text-sm">
          Prochaine question dans quelques secondes...
        </p>
        <div className="mt-2">
          <Progress value={100} variant="brand" size="sm" animated />
        </div>
      </motion.div>
    </motion.div>
  );
}
