"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Button } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { useUIStore } from "@/stores";

export function HomeScreen() {
  const setScreen = useUIStore((s) => s.setScreen);

  return (
    <ScreenContainer className="overflow-hidden">
      <div className="w-full max-w-sm mx-auto">
        {/* Logo: stylized "?" in serif font */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <motion.div
            className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-brand-500 flex items-center justify-center"
            initial={{ rotate: -6 }}
            animate={{ rotate: [-6, -3, -6] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="font-display text-6xl text-white font-bold select-none" style={{ lineHeight: 1 }}>
              ?
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl sm:text-6xl font-display font-bold text-surface-100 italic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Quizz Arena
          </motion.h1>
          <motion.p
            className="text-surface-400 text-lg mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Défie tes amis en temps réel
          </motion.p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => setScreen("create")}
          >
            Créer une partie
          </Button>

          <Button
            variant="secondary"
            size="xl"
            fullWidth
            onClick={() => setScreen("join")}
            leftIcon={<Users className="w-5 h-5" />}
          >
            Rejoindre
          </Button>
        </motion.div>

        {/* Feature tags */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-14 flex items-center justify-center gap-3 text-surface-500 text-sm"
        >
          <span>Quiz rapides</span>
          <span className="w-1 h-1 rounded-full bg-surface-700" />
          <span>Multijoueur</span>
          <span className="w-1 h-1 rounded-full bg-surface-700" />
          <span>Classements</span>
        </motion.div>
      </div>
    </ScreenContainer>
  );
}
