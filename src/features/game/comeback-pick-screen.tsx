"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useGameStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { GAME_MODES } from "@/types";
import type { GameMode } from "@/types";
import { Avatar } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { cn } from "@/lib/utils";

export function ComebackPickScreen() {
  const comebackPickData = useGameStore((s) => s.comebackPickData);
  const comebackModePicked = useGameStore((s) => s.comebackModePicked);
  const myPlayerId = usePlayerStore((s) => s.playerId);
  const { chooseComebackMode } = useSocket();
  const [timeLeft, setTimeLeft] = useState(10);

  const isMyTurn = comebackPickData?.playerId === myPlayerId;

  // Countdown timer
  useEffect(() => {
    if (!comebackPickData || comebackModePicked) return;
    setTimeLeft(comebackPickData.timeLimit);
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [comebackPickData, comebackModePicked]);

  // Mode picked — show result
  if (comebackModePicked) {
    const pickedMode = GAME_MODES.find((m) => m.id === comebackModePicked.mode);
    return (
      <ScreenContainer centered className="py-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <p className="text-surface-400 text-sm">
            {comebackModePicked.playerName} a choisi
          </p>
          <div className="text-6xl">{pickedMode?.icon}</div>
          <p className="text-2xl font-display font-bold text-surface-100">
            {pickedMode?.name}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 text-amber-400 text-sm font-medium">
            <span>×2</span>
            <span>Points doublés pour {comebackModePicked.playerName}</span>
          </div>
        </motion.div>
      </ScreenContainer>
    );
  }

  if (!comebackPickData) return null;

  const availableModes = comebackPickData.availableModes
    .map((modeId) => GAME_MODES.find((m) => m.id === modeId))
    .filter(Boolean);

  return (
    <ScreenContainer centered={false} className="py-6">
      <div className="w-full max-w-lg mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <Avatar emoji={comebackPickData.playerAvatar} size="lg" />
          </div>
          <p className="text-surface-400 text-sm mb-1">Aide aux derniers</p>
          <p className="text-xl font-display font-bold text-surface-100">
            {isMyTurn ? "Choisis le prochain mode !" : `${comebackPickData.playerName} choisit...`}
          </p>

          {/* Timer */}
          <motion.div
            className="mt-3 flex items-center justify-center"
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2",
              timeLeft <= 3 ? "border-red-500 text-red-400" : "border-brand-500 text-brand-400"
            )}>
              {timeLeft}
            </div>
          </motion.div>
        </motion.div>

        {/* Mode grid (only clickable if it's my turn) */}
        {isMyTurn ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-3 gap-2"
          >
            {availableModes.map((mode) => (
              <ModeButton
                key={mode!.id}
                mode={mode!}
                onClick={() => chooseComebackMode(mode!.id as GameMode)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {availableModes.map((mode) => (
                <span
                  key={mode!.id}
                  className="px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 text-center"
                >
                  <span className="text-lg">{mode!.icon}</span>
                  <span className="text-xs text-surface-400 ml-1">{mode!.name}</span>
                </span>
              ))}
            </div>
            <p className="text-surface-500 text-sm mt-6">
              En attente du choix de {comebackPickData.playerName}...
            </p>
          </motion.div>
        )}
      </div>
    </ScreenContainer>
  );
}

function ModeButton({ mode, onClick }: { mode: { id: string; name: string; icon: string; color: string }; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="p-3 rounded-xl text-center border border-surface-700 bg-surface-800 hover:border-brand-500 hover:bg-brand-500/10 active:bg-brand-500/20 transition-colors"
    >
      <span className="text-2xl block mb-1">{mode.icon}</span>
      <span className="text-xs font-medium text-surface-300 block truncate">
        {mode.name}
      </span>
    </motion.button>
  );
}
