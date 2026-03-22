"use client";

import { motion } from "framer-motion";
import { useGameStore, usePlayerStore } from "@/stores";

export function ValiseRevealScreen() {
  const valiseReveal = useGameStore((s) => s.valiseReveal);
  const myPlayerId = usePlayerStore((s) => s.playerId);

  if (!valiseReveal) return null;

  const {
    valiseValue,
    porteurId, porteurName, porteurAvatar, porteurSignal,
    voleurId, voleurName, voleurAvatar, voleurChoice,
    playerScores,
  } = valiseReveal;

  const isPositive = valiseValue > 0;
  const porteurScore = playerScores.find((s) => s.playerId === porteurId);
  const voleurScore = playerScores.find((s) => s.playerId === voleurId);
  const myScore = playerScores.find((s) => s.playerId === myPlayerId);

  // Did the voleur get tricked by bluff?
  const voleurGotBadDeal = voleurChoice === "voler" && valiseValue < 0;
  const voleurGotGoodDeal = voleurChoice === "voler" && valiseValue > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center h-full px-4 pt-4 pb-8 gap-4 overflow-y-auto"
    >
      <motion.h2
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-display font-bold text-surface-100"
      >
        Valise Mystère
      </motion.h2>

      {/* Valise reveal */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className={`px-8 py-5 rounded-2xl border-2 ${
          isPositive
            ? "bg-emerald-950/40 border-emerald-500"
            : "bg-red-950/40 border-red-500"
        }`}
      >
        <p className="text-surface-400 text-xs text-center mb-1">La valise contenait</p>
        <p className={`text-5xl font-display font-bold text-center ${
          isPositive ? "text-emerald-400" : "text-red-400"
        }`}>
          {valiseValue > 0 ? "+" : ""}{valiseValue}
        </p>
      </motion.div>

      {/* Players and their actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm space-y-3"
      >
        {/* Porteur */}
        <div className={`rounded-xl p-4 border ${
          porteurId === myPlayerId ? "border-brand-500/50 bg-brand-950/20" : "bg-surface-800/50 border-surface-700"
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{porteurAvatar}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm truncate ${porteurId === myPlayerId ? "text-brand-400" : "text-surface-200"}`}>
                {porteurName}
                {porteurId === myPlayerId && " (toi)"}
              </p>
              <p className="text-xs text-surface-400">
                💼 Porteur
                {porteurSignal && (
                  <span className={porteurSignal === "prends" ? " · a dit \"Prends\"" : " · a dit \"Laisse\""} />
                )}
              </p>
              {porteurSignal && (
                <p className="text-xs text-surface-500 mt-0.5">
                  A dit « {porteurSignal === "prends" ? "Prends ✅" : "Laisse 🚫"} »
                </p>
              )}
            </div>
            <span className={`text-lg font-bold ${
              (porteurScore?.points || 0) > 0 ? "text-emerald-400" : (porteurScore?.points || 0) < 0 ? "text-red-400" : "text-surface-500"
            }`}>
              {(porteurScore?.points || 0) > 0 ? "+" : ""}{porteurScore?.points || 0}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className={`text-2xl ${
              voleurChoice === "voler" ? "text-purple-400" : "text-amber-400"
            }`}
          >
            {voleurChoice === "voler" ? "💀 Volé !" : "🤝 Laissé"}
          </motion.div>
        </div>

        {/* Voleur */}
        <div className={`rounded-xl p-4 border ${
          voleurId === myPlayerId ? "border-brand-500/50 bg-brand-950/20" : "bg-surface-800/50 border-surface-700"
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{voleurAvatar}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm truncate ${voleurId === myPlayerId ? "text-brand-400" : "text-surface-200"}`}>
                {voleurName}
                {voleurId === myPlayerId && " (toi)"}
              </p>
              <p className="text-xs text-surface-400">
                🕵️ Décideur · {voleurChoice === "voler" ? "a volé 💀" : "a laissé 🤝"}
              </p>
            </div>
            <span className={`text-lg font-bold ${
              (voleurScore?.points || 0) > 0 ? "text-emerald-400" : (voleurScore?.points || 0) < 0 ? "text-red-400" : "text-surface-500"
            }`}>
              {(voleurScore?.points || 0) > 0 ? "+" : ""}{voleurScore?.points || 0}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Bluff indicator */}
      {porteurSignal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="text-center"
        >
          {porteurSignal === "prends" && valiseValue < 0 && (
            <p className="text-red-400 text-sm font-semibold">🎭 Bluff ! La valise était piégée</p>
          )}
          {porteurSignal === "laisse" && valiseValue > 0 && (
            <p className="text-emerald-400 text-sm font-semibold">🎭 Bluff ! La valise était positive</p>
          )}
          {porteurSignal === "prends" && valiseValue > 0 && (
            <p className="text-surface-400 text-sm">Honnête — la valise était bien positive</p>
          )}
          {porteurSignal === "laisse" && valiseValue < 0 && (
            <p className="text-surface-400 text-sm">Honnête — la valise était bien négative</p>
          )}
        </motion.div>
      )}

      {/* My score this round */}
      {myScore && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center mt-2"
        >
          <p className="text-surface-400 text-sm">Ton score ce round</p>
          <p className={`text-3xl font-display font-bold ${
            myScore.points > 0 ? "text-emerald-400" : myScore.points < 0 ? "text-red-400" : "text-surface-400"
          }`}>
            {myScore.points > 0 ? "+" : ""}{myScore.points}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
