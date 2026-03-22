"use client";

import { motion } from "framer-motion";
import { useGameStore } from "@/stores";
import { useSocket } from "@/hooks";

export function ValiseChoiceScreen() {
  const valiseData = useGameStore((s) => s.valiseData);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const myAnswer = useGameStore((s) => s.myAnswer);
  const porteurSignal = useGameStore((s) => s.valisePorteurSignal);
  const { submitValiseSignal, submitValiseChoice } = useSocket();

  if (!valiseData) return null;

  const { role, valiseValue, opponentName, opponentAvatar } = valiseData;
  const isPorteur = role === "porteur";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full px-4 gap-5"
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

      {/* Role badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className={`px-4 py-1.5 rounded-full text-sm font-bold ${
          isPorteur
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
        }`}
      >
        {isPorteur ? "💼 Tu as la valise" : "🕵️ Tu décides"}
      </motion.div>

      {/* Opponent info */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="text-center"
      >
        <div className="text-5xl mb-2">{opponentAvatar}</div>
        <p className="text-surface-400 text-sm">
          {isPorteur ? "L'autre joueur" : "Le porteur"}
        </p>
        <p className="text-lg font-display font-bold text-surface-100">{opponentName}</p>
      </motion.div>

      {/* Valise display */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-center"
      >
        {isPorteur ? (
          <div className="px-6 py-4 rounded-2xl bg-surface-800/80 border border-surface-700">
            <p className="text-surface-400 text-xs mb-1">Ta valise contient</p>
            <p className={`text-4xl font-display font-bold ${
              valiseValue! > 0 ? "text-emerald-400" : "text-red-400"
            }`}>
              {valiseValue! > 0 ? "+" : ""}{valiseValue} pts
            </p>
          </div>
        ) : (
          <div className="px-6 py-4 rounded-2xl bg-surface-800/80 border border-surface-700">
            <p className="text-surface-400 text-xs mb-1">La valise contient</p>
            <p className="text-4xl font-display font-bold text-surface-500">???</p>
            <p className="text-surface-500 text-xs mt-1">entre -200 et +200 pts</p>
          </div>
        )}
      </motion.div>

      {/* Porteur signal received (voleur side) */}
      {!isPorteur && porteurSignal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold ${
            porteurSignal === "prends"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {opponentName} te dit : {porteurSignal === "prends" ? "\"Prends !\" ✅" : "\"Laisse !\" 🚫"}
        </motion.div>
      )}

      {/* Choice buttons */}
      {!hasAnswered ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4 w-full max-w-sm"
        >
          {isPorteur ? (
            <>
              <button
                onClick={() => submitValiseSignal("prends")}
                className="flex-1 py-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-display font-bold text-lg shadow-lg active:scale-95 transition-transform touch"
              >
                <span className="text-2xl block mb-1">✅</span>
                Prends
              </button>
              <button
                onClick={() => submitValiseSignal("laisse")}
                className="flex-1 py-5 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white font-display font-bold text-lg shadow-lg active:scale-95 transition-transform touch"
              >
                <span className="text-2xl block mb-1">🚫</span>
                Laisse
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => submitValiseChoice("voler")}
                className="flex-1 py-5 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white font-display font-bold text-lg shadow-lg active:scale-95 transition-transform touch"
              >
                <span className="text-2xl block mb-1">💀</span>
                Voler
              </button>
              <button
                onClick={() => submitValiseChoice("laisser")}
                className="flex-1 py-5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white font-display font-bold text-lg shadow-lg active:scale-95 transition-transform touch"
              >
                <span className="text-2xl block mb-1">🤝</span>
                Laisser
              </button>
            </>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="text-5xl mb-2">
            {isPorteur
              ? (myAnswer === "prends" ? "✅" : "🚫")
              : (myAnswer === "voler" ? "💀" : "🤝")
            }
          </div>
          <p className="text-surface-300 font-display font-semibold text-lg">
            {isPorteur
              ? <>Tu as dit <span className={myAnswer === "prends" ? "text-emerald-400" : "text-red-400"}>{myAnswer === "prends" ? "Prends" : "Laisse"}</span></>
              : <>Tu as choisi <span className={myAnswer === "voler" ? "text-purple-400" : "text-amber-400"}>{myAnswer === "voler" ? "Voler" : "Laisser"}</span></>
            }
          </p>
          {isPorteur && (
            <p className="text-surface-500 text-sm mt-2">
              En attente de la décision...
            </p>
          )}
        </motion.div>
      )}

      {/* Rules reminder */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-center text-xs text-surface-500 max-w-xs"
      >
        <p>Voler = tu prends les points (+ ou -) | Laisser = le porteur garde les points</p>
      </motion.div>
    </motion.div>
  );
}
