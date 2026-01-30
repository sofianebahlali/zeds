"use client";

import { motion } from "framer-motion";
import Confetti from "react-confetti";
import { Trophy, Medal, Award, Home, RotateCcw, Share2 } from "lucide-react";
import { Button, Card, Avatar, Badge } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { useRoomStore, useGameStore, useUIStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function ScoreboardScreen() {
  const players = useRoomStore((s) => s.players);
  const room = useRoomStore((s) => s.room);
  const isHost = usePlayerStore((s) => s.isHost);
  const setScreen = useUIStore((s) => s.setScreen);
  const addNotification = useUIStore((s) => s.addNotification);
  const resetGame = useGameStore((s) => s.resetGame);
  const { leaveRoom, socket } = useSocket();

  const [showConfetti, setShowConfetti] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  const myPlayerId = `player_${socket.id}`;
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const isWinner = winner?.id === myPlayerId;
  const myRank = sortedPlayers.findIndex((p) => p.id === myPlayerId) + 1;

  useEffect(() => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleShare = async () => {
    const text = `J'ai terminé ${getOrdinal(myRank)} sur Quizz Arena avec ${
      sortedPlayers.find((p) => p.id === myPlayerId)?.score || 0
    } points ! 🎮`;

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      addNotification({ type: "success", message: "Copié !" });
    }
  };

  const handlePlayAgain = () => {
    resetGame();
    setScreen("lobby");
  };

  const handleGoHome = () => {
    leaveRoom();
    resetGame();
    setScreen("home");
  };

  const getOrdinal = (n: number) => {
    return n === 1 ? "1er" : `${n}ème`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-8 h-8 text-warning-400" />;
      case 2:
        return <Medal className="w-8 h-8 text-surface-300" />;
      case 3:
        return <Award className="w-8 h-8 text-amber-600" />;
      default:
        return null;
    }
  };

  return (
    <ScreenContainer>
      {/* Confetti for winner */}
      {showConfetti && isWinner && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          colors={["#0ea5e9", "#d946ef", "#22c55e", "#f59e0b"]}
        />
      )}

      <div className="w-full max-w-md mx-auto">
        {/* Winner spotlight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="text-center mb-8"
        >
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative inline-block mb-4"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 blur-2xl">
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-warning-500 to-warning-600 opacity-50" />
            </div>

            {/* Winner avatar */}
            <div className="relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Trophy className="w-10 h-10 text-warning-400" />
              </div>
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-warning-500 to-warning-600 flex items-center justify-center text-5xl border-4 border-warning-400/50 shadow-2xl">
                {winner?.avatar}
              </div>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-white mb-1"
          >
            {winner?.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-warning-400 font-semibold"
          >
            remporte la partie ! 🏆
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-bold text-white mt-2"
          >
            {winner?.score} points
          </motion.p>
        </motion.div>

        {/* Your result (if not winner) */}
        {!isWinner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card variant="gradient" gradient="from-brand-500/20 to-accent-500/20" className="mb-6">
              <div className="flex items-center gap-4">
                <Avatar
                  emoji={sortedPlayers.find((p) => p.id === myPlayerId)?.avatar || "🦊"}
                  size="lg"
                />
                <div className="flex-1">
                  <p className="text-surface-400 text-sm">Ton classement</p>
                  <p className="text-2xl font-bold text-white">
                    {getOrdinal(myRank)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-surface-400 text-sm">Score</p>
                  <p className="text-2xl font-bold text-white">
                    {sortedPlayers.find((p) => p.id === myPlayerId)?.score || 0}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Full leaderboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <h2 className="text-sm font-medium text-surface-400 mb-3">
            Classement final
          </h2>
          <Card variant="glass" padding="sm">
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => {
                const rank = index + 1;
                const isMe = player.id === myPlayerId;

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      rank <= 3 && "bg-surface-800/50",
                      isMe && "ring-2 ring-brand-500/50"
                    )}
                  >
                    {/* Rank */}
                    <div className="w-8 shrink-0 flex justify-center">
                      {getRankIcon(rank) || (
                        <span className="text-surface-500 font-bold">{rank}</span>
                      )}
                    </div>

                    {/* Player */}
                    <Avatar emoji={player.avatar} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-white truncate block">
                        {player.name}
                        {isMe && (
                          <span className="text-surface-500 text-xs ml-1">
                            (toi)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Score */}
                    <span className="font-bold text-white">{player.score}</span>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleShare}
              leftIcon={<Share2 className="w-5 h-5" />}
            >
              Partager
            </Button>

            {isHost && (
              <Button
                variant="accent"
                size="lg"
                onClick={handlePlayAgain}
                leftIcon={<RotateCcw className="w-5 h-5" />}
              >
                Rejouer
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={handleGoHome}
            leftIcon={<Home className="w-5 h-5" />}
          >
            Retour à l'accueil
          </Button>
        </motion.div>
      </div>
    </ScreenContainer>
  );
}
