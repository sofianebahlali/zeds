"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  Crown,
  LogOut,
  Play,
  Plus,
  Minus,
  Settings,
  Trash2,
  Users,
  WifiOff,
  Shield,
} from "lucide-react";
import { Button, Card, Avatar, Badge, StatusBadge, ScrollArea } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { useRoomStore, usePlayerStore, useUIStore } from "@/stores";
import { useSocket } from "@/hooks";
import { GAME_MODES, DEFAULT_PLAYLIST } from "@/types";
import type { GameModeConfig } from "@/types";
import { cn } from "@/lib/utils";

export function LobbyScreen() {
  const room = useRoomStore((s) => s.room);
  const players = useRoomStore((s) => s.players);
  const isHost = usePlayerStore((s) => s.isHost);
  const isReady = usePlayerStore((s) => s.isReady);
  const playerId = usePlayerStore((s) => s.playerId);

  const addNotification = useUIStore((s) => s.addNotification);

  const { leaveRoom, setReady, startGame, updateRoomSettings } = useSocket();

  const [copied, setCopied] = useState(false);
  const myPlayerId = playerId;
  const [showSettings, setShowSettings] = useState(false);

  if (!room) return null;

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    addNotification({ type: "success", message: "Code copié !" });
    setTimeout(() => setCopied(false), 2000);
  };

  const readyCount = players.filter((p) => p.isReady || p.isHost).length;
  const playlist = room.settings.playlist || DEFAULT_PLAYLIST;
  const isComebackMode = room.settings.comebackMode ?? false;
  const comebackTotalRounds = room.settings.comebackTotalRounds ?? 15;
  const hasDrawing = !isComebackMode && playlist.some((s) => s.mode === "drawing");
  const hasPetitBac = !isComebackMode && playlist.some((s) => s.mode === "petitbac");
  const minPlayers = hasDrawing ? 3 : hasPetitBac ? 2 : 1;
  const hasEnoughPlayers = players.length >= minPlayers;
  const canStart = hasEnoughPlayers && players.every((p) => p.isReady || p.isHost);
  const totalRounds = isComebackMode ? comebackTotalRounds : playlist.reduce((sum, s) => sum + s.rounds, 0);

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

        {/* Playlist builder (host only) */}
        <AnimatePresence>
          {showSettings && isHost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6 space-y-4"
            >
              {/* Aide aux derniers toggle */}
              <Card>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-surface-100">Aide aux derniers</p>
                    <p className="text-xs text-surface-500">Le dernier choisit le mode et gagne ×2</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={isComebackMode}
                    onClick={() => updateRoomSettings({ comebackMode: !isComebackMode })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      isComebackMode ? "bg-amber-500" : "bg-surface-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                        isComebackMode ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </label>
                {isComebackMode && (
                  <div className="mt-4 pt-3 border-t border-surface-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-surface-400">Nombre de manches</p>
                      <span className="text-sm font-mono font-bold text-surface-100">{comebackTotalRounds}</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      step={1}
                      value={comebackTotalRounds}
                      onChange={(e) => updateRoomSettings({ comebackTotalRounds: parseInt(e.target.value) })}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-700 accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-surface-600 mt-1">
                      <span>5</span>
                      <span>30</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Playlist builder — hidden in comeback mode */}
              {!isComebackMode && (
                <PlaylistBuilder
                  playlist={playlist}
                  onChange={(newPlaylist) => {
                    updateRoomSettings({ playlist: newPlaylist });
                  }}
                />
              )}
              <Card>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-surface-100">Manches en équipe</p>
                    <p className="text-xs text-surface-500">Active des manches aléatoires en équipe</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={room.settings.teamRoundsEnabled}
                    onClick={() => updateRoomSettings({ teamRoundsEnabled: !room.settings.teamRoundsEnabled })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      room.settings.teamRoundsEnabled ? "bg-brand-500" : "bg-surface-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                        room.settings.teamRoundsEnabled ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </label>
              </Card>
              <Card>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-surface-100">Cacher les scores</p>
                    <p className="text-xs text-surface-500">Les scores ne sont révélés qu&apos;à la fin</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={room.settings.hideScoresBetweenRounds}
                    onClick={() => updateRoomSettings({ hideScoresBetweenRounds: !room.settings.hideScoresBetweenRounds })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      room.settings.hideScoresBetweenRounds ? "bg-brand-500" : "bg-surface-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                        room.settings.hideScoresBetweenRounds ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </label>
              </Card>
              <Card>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-surface-100">Mixer les manches</p>
                    <p className="text-xs text-surface-500">Mélange les modes pour varier les plaisirs</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={room.settings.shufflePlaylist}
                    onClick={() => updateRoomSettings({ shufflePlaylist: !room.settings.shufflePlaylist })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      room.settings.shufflePlaylist ? "bg-brand-500" : "bg-surface-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                        room.settings.shufflePlaylist ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </label>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Playlist summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <div className="flex items-center justify-center gap-1.5 text-surface-400 flex-wrap">
            {isComebackMode ? (
              <>
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">Aide aux derniers</span>
                <span className="text-surface-600 ml-1">·</span>
                <span className="text-sm ml-1">{totalRounds} manches</span>
              </>
            ) : (
              <>
                {playlist.map((seg, i) => {
                  const mode = GAME_MODES.find((m) => m.id === seg.mode);
                  return (
                    <span key={i} className="flex items-center gap-0.5">
                      {i > 0 && <span className="text-surface-600 mx-1">→</span>}
                      <span className="text-base">{mode?.icon}</span>
                      <span className="text-xs">{seg.rounds}</span>
                    </span>
                  );
                })}
                <span className="text-surface-600 ml-2">·</span>
                <span className="text-sm ml-1">{totalRounds} manches</span>
              </>
            )}
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
                : !hasEnoughPlayers && hasDrawing
                ? `${minPlayers} joueurs minimum (mode dessin)`
                : !hasEnoughPlayers && hasPetitBac
                ? "2 joueurs minimum (mode Petit Bac)"
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

// ==========================================
// PLAYLIST BUILDER
// ==========================================

interface PlaylistBuilderProps {
  playlist: GameModeConfig[];
  onChange: (playlist: GameModeConfig[]) => void;
}

function PlaylistBuilder({ playlist, onChange }: PlaylistBuilderProps) {
  const [showAddMode, setShowAddMode] = useState(false);

  const updateRounds = (index: number, delta: number) => {
    const newPlaylist = [...playlist];
    const newRounds = newPlaylist[index].rounds + delta;
    if (newRounds < 1 || newRounds > 10) return;
    newPlaylist[index] = { ...newPlaylist[index], rounds: newRounds };
    onChange(newPlaylist);
  };

  const removeSegment = (index: number) => {
    if (playlist.length <= 1) return;
    const newPlaylist = playlist.filter((_, i) => i !== index);
    onChange(newPlaylist);
  };

  const addSegment = (modeId: string) => {
    onChange([...playlist, { mode: modeId as GameModeConfig["mode"], rounds: 2 }]);
    setShowAddMode(false);
  };

  const availableModes = GAME_MODES.filter(
    (m) => !playlist.some((s) => s.mode === m.id)
  );

  return (
    <Card>
      <h3 className="text-sm font-medium text-surface-400 mb-3">
        Playlist des modes
      </h3>
      <div className="space-y-2">
        {playlist.map((seg, i) => {
          const mode = GAME_MODES.find((m) => m.id === seg.mode);
          if (!mode) return null;
          return (
            <div
              key={`${seg.mode}-${i}`}
              className="flex items-center gap-2 p-2 rounded-lg bg-surface-800 border border-surface-700"
            >
              <span className="text-xl">{mode.icon}</span>
              <span className="text-sm font-medium text-surface-100 flex-1 truncate">
                {mode.name}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateRounds(i, -1)}
                  disabled={seg.rounds <= 1}
                  className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-mono font-bold text-surface-100 w-5 text-center">
                  {seg.rounds}
                </span>
                <button
                  onClick={() => updateRounds(i, 1)}
                  disabled={seg.rounds >= 10}
                  className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => removeSegment(i)}
                disabled={playlist.length <= 1}
                className="p-1 rounded-md text-surface-500 hover:text-red-400 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed ml-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add mode button */}
      {availableModes.length > 0 && (
        <div className="mt-3">
          {showAddMode ? (
            <div className="grid grid-cols-3 gap-2">
              {availableModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => addSegment(mode.id)}
                  className="p-2 rounded-lg text-center border border-surface-700 bg-surface-800 hover:border-brand-500 hover:bg-brand-500/10 transition-colors"
                >
                  <span className="text-lg block">{mode.icon}</span>
                  <span className="text-[10px] font-medium text-surface-300">
                    {mode.name}
                  </span>
                </button>
              ))}
              <button
                onClick={() => setShowAddMode(false)}
                className="p-2 rounded-lg text-center border border-surface-700 bg-surface-800 hover:border-surface-500 transition-colors text-xs text-surface-500"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddMode(true)}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-surface-600 text-surface-400 hover:border-brand-500 hover:text-brand-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Ajouter un mode</span>
            </button>
          )}
        </div>
      )}
    </Card>
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
