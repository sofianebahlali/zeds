"use client";

import { motion } from "framer-motion";
import { useGameStore } from "@/stores";
import { useSocket } from "@/hooks";

export function SplitStealChoiceScreen() {
  const splitStealData = useGameStore((s) => s.splitStealData);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const myAnswer = useGameStore((s) => s.myAnswer);
  const { submitSplitStealChoice } = useSocket();

  if (!splitStealData) return null;

  const { pairingType, targetName, targetAvatar, incomingName, incomingAvatar } = splitStealData;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full px-4 gap-6"
    >
      {/* Timer */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={`text-5xl font-display font-bold ${timeRemaining <= 5 ? "text-red-500" : "text-surface-300"}`}>
          {timeRemaining}
        </div>
      </motion.div>

      {/* Target info */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center"
      >
        <div className="text-6xl mb-2">{targetAvatar}</div>
        <p className="text-surface-300 text-sm mb-1">
          {pairingType === "pair" ? "Tu joues contre" : "Tu decides pour"}
        </p>
        <p className="text-xl font-display font-bold text-surface-100">{targetName}</p>
      </motion.div>

      {/* Cycle info */}
      {pairingType === "cycle" && incomingName && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center px-4 py-2 rounded-lg bg-surface-800/50 border border-surface-700"
        >
          <p className="text-surface-400 text-xs">
            {incomingAvatar} <span className="font-semibold text-surface-300">{incomingName}</span> decide pour toi
          </p>
        </motion.div>
      )}

      {/* Stakes info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <p className="text-surface-400 text-sm">
          En jeu : <span className="text-amber-400 font-bold">250 pts</span>
        </p>
      </motion.div>

      {/* Choice buttons */}
      {!hasAnswered ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4 w-full max-w-sm"
        >
          <button
            onClick={() => submitSplitStealChoice("split")}
            className="flex-1 py-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-display font-bold text-xl shadow-lg active:scale-95 transition-transform touch"
          >
            <span className="text-3xl block mb-1">🤝</span>
            Split
            <span className="block text-xs font-sans font-normal text-emerald-200 mt-1">+100 chacun</span>
          </button>
          <button
            onClick={() => submitSplitStealChoice("steal")}
            className="flex-1 py-6 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white font-display font-bold text-xl shadow-lg active:scale-95 transition-transform touch"
          >
            <span className="text-3xl block mb-1">💀</span>
            Steal
            <span className="block text-xs font-sans font-normal text-red-200 mt-1">+250 / -200</span>
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className={`text-6xl mb-3 ${myAnswer === "split" ? "" : ""}`}>
            {myAnswer === "split" ? "🤝" : "💀"}
          </div>
          <p className="text-surface-300 font-display font-semibold text-lg">
            Tu as choisi <span className={myAnswer === "split" ? "text-emerald-400" : "text-red-400"}>{myAnswer === "split" ? "Split" : "Steal"}</span>
          </p>
          <p className="text-surface-500 text-sm mt-2">
            En attente des autres joueurs...
          </p>
        </motion.div>
      )}

      {/* Rules reminder */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-xs text-surface-500 max-w-xs"
      >
        {pairingType === "pair" ? (
          <p>Split/Split = +100 chacun | Steal/Split = +250/0 | Steal/Steal = -200 chacun</p>
        ) : (
          <p>Split = +100 chacun | Steal = +250/0 | Vol + victime de vol = -200</p>
        )}
      </motion.div>
    </motion.div>
  );
}
