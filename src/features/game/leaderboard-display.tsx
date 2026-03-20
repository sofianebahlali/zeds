"use client";

import { motion } from "framer-motion";
import { Trophy, Medal, Award } from "lucide-react";
import { Card, Avatar, Progress } from "@/components/ui";
import { useRoomStore, useGameStore, usePlayerStore } from "@/stores";
import { cn } from "@/lib/utils";

export function LeaderboardDisplay() {
  const players = useRoomStore((s) => s.players);
  const room = useRoomStore((s) => s.room);
  const currentRound = useGameStore((s) => s.currentRound);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const teamRoundResult = useGameStore((s) => s.teamRoundResult);
  const teamData = useGameStore((s) => s.teamData);
  const myPlayerId = usePlayerStore((s) => s.playerId);
  const hideScores = room?.settings.hideScoresBetweenRounds ?? false;
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

      {/* Team round result */}
      {teamRoundResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-4 p-4 rounded-xl bg-surface-900 border border-surface-700"
        >
          <h3 className="text-sm font-medium text-surface-400 text-center mb-3">Résultat équipe</h3>
          <div className="flex items-center justify-center gap-4">
            {teamRoundResult.teams.map((team) => {
              const isWinner = teamRoundResult.winningTeamId === team.teamId;
              return (
                <motion.div
                  key={team.teamId}
                  animate={isWinner ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: 2, duration: 0.4 }}
                  className={cn(
                    "flex-1 text-center p-3 rounded-lg border",
                    team.teamId === "blue"
                      ? isWinner ? "bg-blue-500/20 border-blue-500" : "bg-blue-500/5 border-blue-500/20"
                      : isWinner ? "bg-red-500/20 border-red-500" : "bg-red-500/5 border-red-500/20"
                  )}
                >
                  <p className={cn(
                    "text-sm font-semibold",
                    team.teamId === "blue" ? "text-blue-400" : "text-red-400"
                  )}>
                    {team.teamName}
                    {isWinner && " 🏆"}
                  </p>
                  <p className="text-2xl font-display font-bold text-surface-100 mt-1">
                    {team.totalPoints}
                    <span className="text-surface-500 text-sm ml-1">pts</span>
                  </p>
                </motion.div>
              );
            })}
          </div>
          {teamRoundResult.winningTeamId === "tie" && (
            <p className="text-xs text-surface-500 text-center mt-2">Égalité !</p>
          )}
          {teamRoundResult.winningTeamId !== "tie" && (
            <p className="text-xs text-surface-500 text-center mt-2">+50 pts bonus pour l&apos;équipe gagnante</p>
          )}
        </motion.div>
      )}

      {/* Leaderboard */}
      <div className="flex-1 space-y-2 overflow-auto">
        {sortedPlayers.map((player, index) => {
          const rank = index + 1;
          const isMe = player.id === myPlayerId;
          const scorePercentage = (player.score / maxScore) * 100;
          const playerTeam = teamRoundResult?.teams.find((t) => t.playerIds.includes(player.id));

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
              {!hideScores && (
                <motion.div
                  className="absolute inset-0 bg-surface-800/50"
                  initial={{ width: 0 }}
                  animate={{ width: `${scorePercentage}%` }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                />
              )}

              {/* Content */}
              <div className="relative flex items-center gap-4 p-4">
                <div className="shrink-0">{getRankIcon(rank)}</div>
                <div className="relative">
                  <Avatar emoji={player.avatar} size="md" />
                  {playerTeam && (
                    <span className={cn(
                      "absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-900",
                      playerTeam.teamId === "blue" ? "bg-blue-500" : "bg-red-500"
                    )} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-surface-100 truncate">
                      {player.name}
                    </span>
                    {isMe && (
                      <span className="text-xs text-surface-500">(toi)</span>
                    )}
                    {player.loseStreak >= 3 && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                        💀 {player.loseStreak} de suite
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-display font-bold text-surface-100">
                    {hideScores ? "?" : player.score}
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
