"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  Crown,
  LogOut,
  Play,
  Settings,
  Users,
  WifiOff,
} from "lucide-react";
import { Button, Card, Avatar, Badge, StatusBadge, ScrollArea } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { useRoomStore, usePlayerStore, useUIStore } from "@/stores";
import { useSocket } from "@/hooks";
import { GAME_MODES } from "@/types";
import { cn } from "@/lib/utils";

export function LobbyScreen() {
  const room = useRoomStore((s) => s.room);
  const players = useRoomStore((s) => s.players);
  const isHost = usePlayerStore((s) => s.isHost);
  const isReady = usePlayerStore((s) => s.isReady);
  const playerId = usePlayerStore((s) => s.playerId);

  const addNotification = useUIStore((s) => s.addNotification);

  const { leaveRoom, setReady, startGame, changeGameMode, socket } = useSocket();

  const [copied, setCopied] = useState(false);
  const myPlayerId = `player_${socket.id}`;
  const [showSettings, setShowSettings] = useState(false);

  if (!room) return null;

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    addNotification({ type: "success", message: "Code copié !" });
    setTimeout(() => setCopied(false), 2000);
  };

  const readyCount = players.filter((p) => p.isReady || p.isHost).length;
  const isDrawingMode = room.gameMode === "drawing";
  const minPlayers = isDrawingMode ? 3 : 1;
  const hasEnoughPlayers = players.length >= minPlayers;
  const canStart = hasEnoughPlayers && players.every((p) => p.isReady || p.isHost);
  const currentMode = GAME_MODES.find((m) => m.id === room.gameMode);

  return (
    <ScreenContainer centered={false} className="py-4">
      <div className="w-full max-w-lg mx-auto flex flex-col h-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={leaveRoom}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Quitter
            </Button>

            {isHost && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                leftIcon={<Settings className="w-4 h-4" />}
              >
                Options
              </Button>
            )}
          </div>

          {/* Room code card */}
          <Card variant="gradient">
            <div className="text-center">
              <p className="text-surface-500 text-sm mb-2">Code de la room</p>
              <button
                onClick={copyCode}
                className="flex items-center justify-center gap-3 mx-auto group"
              >
                <span className="text-4xl font-display font-bold tracking-[0.3em] text-surface-100">
                  {room.code}
                </span>
                <motion.span
                  key={copied ? "check" : "copy"}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    copied
                      ? "bg-success-500/15 text-success-400"
                      : "bg-surface-800 text-surface-400 group-hover:text-surface-100"
                  )}
                >
                  {copied ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </motion.span>
              </button>
              <p className="text-surface-500 text-xs mt-2">
                Partage ce code avec tes amis
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Game mode settings (host only) */}
        <AnimatePresence>
          {showSettings && isHost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              <Card>
                <h3 className="text-sm font-medium text-surface-400 mb-3">
                  Mode de jeu
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {GAME_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => changeGameMode(mode.id)}
                      className={cn(
                        "p-3 rounded-xl text-center transition-colors",
                        "border",
                        room.gameMode === mode.id
                          ? "border-brand-500 bg-brand-500/10"
                          : "border-surface-700 bg-surface-800 hover:border-surface-500"
                      )}
                    >
                      <span className="text-2xl mb-1 block">{mode.icon}</span>
                      <span className="text-xs font-medium text-surface-100">
                        {mode.name}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current game mode */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <div className="flex items-center justify-center gap-2 text-surface-400">
            <span className="text-2xl">{currentMode?.icon}</span>
            <span className="text-sm">{currentMode?.name}</span>
            <span className="text-surface-600">·</span>
            <span className="text-sm">{room.settings.totalRounds} manches</span>
          </div>
        </motion.div>

        {/* Players list */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex-1 min-h-0"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-surface-400">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">
                Joueurs ({players.length}/{room.settings.maxPlayers})
              </span>
            </div>
            <Badge variant="primary" size="sm">
              {readyCount} prêts
            </Badge>
          </div>

          <ScrollArea className="h-[280px]">
            <div className="space-y-2 pr-2">
              <AnimatePresence mode="popLayout">
                {players.map((player, index) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    isCurrentPlayer={player.id === myPlayerId}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 space-y-3"
        >
          {isHost ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={startGame}
              disabled={!canStart}
              leftIcon={<Play className="w-5 h-5" />}
            >
              {canStart
                ? "Lancer la partie"
                : !hasEnoughPlayers && isDrawingMode
                ? `${minPlayers} joueurs minimum pour le dessin`
                : "En attente des joueurs..."}
            </Button>
          ) : (
            <Button
              variant={isReady ? "success" : "primary"}
              size="lg"
              fullWidth
              onClick={() => setReady(!isReady)}
            >
              {isReady ? "Prêt !" : "Je suis prêt"}
            </Button>
          )}
        </motion.div>
      </div>
    </ScreenContainer>
  );
}

interface PlayerCardProps {
  player: {
    id: string;
    name: string;
    avatar: string;
    isHost: boolean;
    isReady: boolean;
    isConnected: boolean;
  };
  isCurrentPlayer: boolean;
  index: number;
}

function PlayerCard({ player, isCurrentPlayer, index }: PlayerCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl",
        "bg-surface-900 border border-surface-800",
        isCurrentPlayer && "border-brand-500/40"
      )}
    >
      <Avatar
        emoji={player.avatar}
        size="md"
        status={
          !player.isConnected
            ? "offline"
            : player.isReady
            ? "ready"
            : "online"
        }
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-surface-100 truncate">
            {player.name}
          </span>
          {player.isHost && (
            <Crown className="w-4 h-4 text-accent-400 shrink-0" />
          )}
          {isCurrentPlayer && (
            <span className="text-xs text-surface-500">(toi)</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!player.isConnected && (
          <WifiOff className="w-4 h-4 text-surface-500" />
        )}
        {player.isHost ? (
          <Badge variant="warning" size="sm">
            Hôte
          </Badge>
        ) : (
          <StatusBadge status={player.isReady ? "ready" : "waiting"} />
        )}
      </div>
    </motion.div>
  );
}
