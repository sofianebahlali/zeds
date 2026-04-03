"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  const myPlayerId = usePlayerStore((s) => s.playerId);
  const setScreen = useUIStore((s) => s.setScreen);
  const addNotification = useUIStore((s) => s.addNotification);
  const resetGame = useGameStore((s) => s.resetGame);
  const { leaveRoom, playAgain } = useSocket();

  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [revealedCount, setRevealedCount] = useState(0);
  const [revealComplete, setRevealComplete] = useState(false);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const isWinner = winner?.id === myPlayerId;
  const myRank = sortedPlayers.findIndex((p) => p.id === myPlayerId) + 1;

  // Reversed order for reveal: last place first
  const revealOrder = [...sortedPlayers].reverse();

  useEffect(() => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Progressive reveal: reveal one player every 1.5s, starting from last place
    const totalPlayers = sortedPlayers.length;
    let count = 0;
    const revealInterval = setInterval(() => {
      count++;
      setRevealedCount(count);
      if (count >= totalPlayers) {
        clearInterval(revealInterval);
        // After all revealed, show winner spotlight + confetti
        setTimeout(() => {
          setRevealComplete(true);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }, 800);
      }
    }, 1500);

    return () => clearInterval(revealInterval);
  }, [sortedPlayers.length]);

  const handleShare = async () => {
    const text = `J'ai terminé ${getOrdinal(myRank)} sur Quizz Arena avec ${
      sortedPlayers.find((p) => p.id === myPlayerId)?.score || 0
    } points !`;

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
    playAgain();
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
        return <Trophy className="w-8 h-8 text-accent-400" />;
      case 2:
        return <Medal className="w-8 h-8 text-surface-300" />;
      case 3:
        return <Award className="w-8 h-8 text-brand-400" />;
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
          colors={["#FF5C39", "#FFB224", "#3DD68C", "#FAF8F5"]}
        />
      )}

      <div className="w-full max-w-md mx-auto">
        {/* Reveal title */}
        {!revealComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mb-6"
          >
            <h2 className="text-xl font-display font-bold text-surface-100">
              Classement final
            </h2>
            <p className="text-surface-400 text-sm mt-1">
              {revealedCount < sortedPlayers.length
                ? `${revealedCount}/${sortedPlayers.length} révélés...`
                : "Et le gagnant est..."}
            </p>
          </motion.div>
        )}

        {/* Progressive reveal: last place → first place */}
        {!revealComplete && (
          <div className="mb-6">
            <Card padding="sm">
              <div className="space-y-1">
                <AnimatePresence>
                  {revealOrder.slice(0, revealedCount).map((player) => {
                    const rank = sortedPlayers.findIndex((p) => p.id === player.id) + 1;
                    const isMe = player.id === myPlayerId;

                    return (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        layout
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl",
                          rank === 1 && "bg-accent-500/10 border border-accent-500/30",
                          rank === 2 && "bg-surface-800/50",
                          rank === 3 && "bg-brand-500/5",
                          isMe && rank > 3 && "bg-brand-500/5 border border-brand-500/20"
                        )}
                      >
                        <div className="w-8 shrink-0 flex justify-center">
                          {getRankIcon(rank) || (
                            <span className="text-surface-500 font-display font-bold">{rank}</span>
                          )}
                        </div>

                        <Avatar emoji={player.avatar} size="sm" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-surface-100 truncate block">
                            {player.name}
                            {isMe && (
                              <span className="text-surface-500 text-xs ml-1">(toi)</span>
                            )}
                          </span>
                        </div>

                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="font-display font-bold text-surface-100"
                        >
                          {player.score}
                        </motion.span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </Card>
          </div>
        )}

        {/* Winner spotlight — shown after full reveal */}
        <AnimatePresence>
          {revealComplete && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="text-center mb-8"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="relative inline-block mb-4"
                >
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Trophy className="w-10 h-10 text-accent-400" />
                  </div>
                  <div className="w-28 h-28 rounded-2xl bg-accent-500/15 border-2 border-accent-500/40 flex items-center justify-center text-5xl">
                    {winner?.avatar}
                  </div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-3xl font-display font-bold text-surface-100 mb-1"
                >
                  {winner?.name}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-accent-400 font-medium"
                >
                  remporte la partie !
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl font-display font-bold text-surface-100 mt-2"
                >
                  {winner?.score} <span className="text-base text-surface-400 font-sans font-normal">points</span>
                </motion.p>
              </motion.div>

              {/* Your result (if not winner) */}
              {!isWinner && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card variant="gradient" className="mb-6">
                    <div className="flex items-center gap-4">
                      <Avatar
                        emoji={sortedPlayers.find((p) => p.id === myPlayerId)?.avatar || "🦊"}
                        size="lg"
                      />
                      <div className="flex-1">
                        <p className="text-surface-400 text-sm">Ton classement</p>
                        <p className="text-2xl font-display font-bold text-surface-100">
                          {getOrdinal(myRank)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-surface-400 text-sm">Score</p>
                        <p className="text-2xl font-display font-bold text-surface-100">
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
                <Card padding="sm">
                  <div className="space-y-1">
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
                            rank === 1 && "bg-surface-800/50",
                            isMe && "bg-brand-500/5 border border-brand-500/20"
                          )}
                        >
                          <div className="w-8 shrink-0 flex justify-center">
                            {getRankIcon(rank) || (
                              <span className="text-surface-500 font-display font-bold">{rank}</span>
                            )}
                          </div>

                          <Avatar emoji={player.avatar} size="sm" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-surface-100 truncate block">
                              {player.name}
                              {isMe && (
                                <span className="text-surface-500 text-xs ml-1">
                                  (toi)
                                </span>
                              )}
                            </span>
                          </div>

                          <span className="font-display font-bold text-surface-100">{player.score}</span>
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

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={isHost ? handlePlayAgain : undefined}
                    disabled={!isHost}
                    leftIcon={<RotateCcw className="w-5 h-5" />}
                  >
                    {isHost ? "Rejouer" : "En attente..."}
                  </Button>
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
            </>
          )}
        </AnimatePresence>
      </div>
    </ScreenContainer>
  );
}
