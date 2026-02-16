"use client";

import { motion } from "framer-motion";
import { useGameStore } from "@/stores";

export function CountdownOverlay() {
  const countdown = useGameStore((s) => s.countdown);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center h-full"
    >
      <div className="text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-surface-400 text-xl mb-8"
        >
          La partie commence dans...
        </motion.p>

        <motion.div
          key={countdown}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <span className="font-display text-[10rem] leading-none font-bold text-brand-500 select-none">
            {countdown}
          </span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-surface-500 mt-8"
        >
          Prépare-toi !
        </motion.p>
      </div>
    </motion.div>
  );
}
