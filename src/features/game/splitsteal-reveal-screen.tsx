"use client";

import { motion } from "framer-motion";
import { useGameStore } from "@/stores";
import { useSocket } from "@/hooks";

export function SplitStealRevealScreen() {
  const splitStealReveal = useGameStore((s) => s.splitStealReveal);
  const { socket } = useSocket();
  const myPlayerId = `player_${socket.id}`;

  if (!splitStealReveal) return null;

  const { pairingType, choices, playerScores } = splitStealReveal;

  // Group choices into interactions for display
  const interactions: {
    from: typeof choices[0];
    to: typeof choices[0] | undefined;
  }[] = [];

  if (pairingType === "pair") {
    // Group by pairs: find mutual choices
    const used = new Set<string>();
    for (const c of choices) {
      if (used.has(c.playerId)) continue;
      const counterpart = choices.find(
        (o) => o.playerId === c.targetPlayerId && o.targetPlayerId === c.playerId
      );
      if (counterpart) {
        interactions.push({ from: c, to: counterpart });
        used.add(c.playerId);
        used.add(counterpart.playerId);
      }
    }
  } else {
    // Cycle: show each directed choice
    for (const c of choices) {
      interactions.push({ from: c, to: undefined });
    }
  }

  const myScore = playerScores.find((s) => s.playerId === myPlayerId);

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
        Resultats
      </motion.h2>

      {/* Interactions */}
      <div className="w-full max-w-sm space-y-3">
        {pairingType === "pair"
          ? interactions.map(({ from, to }, i) => {
              if (!to) return null;
              const bothSteal = from.choice === "steal" && to.choice === "steal";
              const bothSplit = from.choice === "split" && to.choice === "split";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.3 }}
                  className={`rounded-xl p-4 border ${
                    bothSteal
                      ? "bg-red-950/30 border-red-800"
                      : bothSplit
                      ? "bg-emerald-950/30 border-emerald-800"
                      : "bg-surface-800/50 border-surface-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <PlayerChoice
                      avatar={from.playerAvatar}
                      name={from.playerName}
                      choice={from.choice}
                      isMe={from.playerId === myPlayerId}
                    />
                    <span className="text-surface-500 text-lg font-bold mx-2">vs</span>
                    <PlayerChoice
                      avatar={to.playerAvatar}
                      name={to.playerName}
                      choice={to.choice}
                      isMe={to.playerId === myPlayerId}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <PointsBadge points={playerScores.find((s) => s.playerId === from.playerId)?.points || 0} />
                    <PointsBadge points={playerScores.find((s) => s.playerId === to.playerId)?.points || 0} />
                  </div>
                </motion.div>
              );
            })
          : /* Cycle mode */
            (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                {choices.map((c, i) => {
                  const scoreEntry = playerScores.find((s) => s.playerId === c.playerId);
                  const target = choices.find((o) => o.playerId === c.targetPlayerId);
                  return (
                    <motion.div
                      key={c.playerId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.2 }}
                      className={`flex items-center gap-3 rounded-xl p-3 border ${
                        scoreEntry?.isCenterOfSteals
                          ? "bg-red-950/30 border-red-800"
                          : "bg-surface-800/50 border-surface-700"
                      }`}
                    >
                      <span className="text-2xl">{c.playerAvatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${c.playerId === myPlayerId ? "text-brand-400" : "text-surface-200"}`}>
                          {c.playerName}
                          {c.playerId === myPlayerId && " (toi)"}
                        </p>
                        <p className="text-xs text-surface-400">
                          {c.choice === "steal" ? "💀 Steal" : "🤝 Split"} {target ? `→ ${target.playerName}` : ""}
                        </p>
                      </div>
                      <PointsBadge points={scoreEntry?.points || 0} />
                      {scoreEntry?.isCenterOfSteals && (
                        <span className="text-xs text-red-400 font-semibold">-200</span>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
      </div>

      {/* My total score */}
      {myScore && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-2"
        >
          <p className="text-surface-400 text-sm">Ton score ce round</p>
          <p className={`text-3xl font-display font-bold ${
            myScore.points > 0 ? "text-emerald-400" : myScore.points < 0 ? "text-red-400" : "text-surface-400"
          }`}>
            {myScore.points > 0 ? "+" : ""}{myScore.points}
          </p>
          {myScore.isCenterOfSteals && (
            <p className="text-red-400 text-xs mt-1">Centre de 2 vols ! Malus -200</p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function PlayerChoice({
  avatar,
  name,
  choice,
  isMe,
}: {
  avatar: string;
  name: string;
  choice: "split" | "steal";
  isMe: boolean;
}) {
  return (
    <div className="text-center flex-1">
      <div className="text-3xl mb-1">{avatar}</div>
      <p className={`text-xs font-semibold truncate ${isMe ? "text-brand-400" : "text-surface-300"}`}>
        {name}{isMe ? " (toi)" : ""}
      </p>
      <motion.div
        initial={{ rotateY: 90 }}
        animate={{ rotateY: 0 }}
        transition={{ delay: 0.5, type: "spring" }}
        className={`mt-2 px-3 py-1 rounded-full text-sm font-bold ${
          choice === "split"
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-red-500/20 text-red-400"
        }`}
      >
        {choice === "split" ? "🤝 Split" : "💀 Steal"}
      </motion.div>
    </div>
  );
}

function PointsBadge({ points }: { points: number }) {
  return (
    <span className={`text-sm font-bold ${
      points > 0 ? "text-emerald-400" : points < 0 ? "text-red-400" : "text-surface-500"
    }`}>
      {points > 0 ? "+" : ""}{points}
    </span>
  );
}
