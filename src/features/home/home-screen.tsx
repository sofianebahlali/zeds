"use client";

import { motion } from "framer-motion";
import { Gamepad2, Users, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { useUIStore } from "@/stores";

export function HomeScreen() {
  const setScreen = useUIStore((s) => s.setScreen);

  return (
    <ScreenContainer className="overflow-hidden">
      <div className="w-full max-w-md mx-auto">
        {/* Logo and Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          {/* Animated Logo */}
          <motion.div
            className="relative w-24 h-24 mx-auto mb-6"
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-500 rounded-3xl rotate-6 opacity-60 blur-lg" />
            <div className="relative bg-gradient-to-br from-brand-500 to-accent-500 rounded-3xl w-full h-full flex items-center justify-center shadow-2xl">
              <Gamepad2 className="w-12 h-12 text-white" />
            </div>
            {/* Sparkles */}
            <motion.div
              className="absolute -top-2 -right-2"
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-6 h-6 text-warning-400" />
            </motion.div>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl font-bold mb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-gradient">Quizz Arena</span>
          </motion.h1>
          <motion.p
            className="text-surface-400 text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Défie tes amis en temps réel !
          </motion.p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => setScreen("create")}
            leftIcon={<Zap className="w-6 h-6" />}
          >
            Créer une partie
          </Button>

          <Button
            variant="glass"
            size="xl"
            fullWidth
            onClick={() => setScreen("join")}
            leftIcon={<Users className="w-6 h-6" />}
          >
            Rejoindre une partie
          </Button>
        </motion.div>

        {/* Features showcase */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 grid grid-cols-3 gap-4"
        >
          {[
            { icon: "🎯", label: "Quiz rapides" },
            { icon: "👥", label: "Multijoueur" },
            { icon: "🏆", label: "Classements" },
          ].map((feature, i) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="text-center p-3 rounded-2xl bg-surface-900/50"
            >
              <div className="text-3xl mb-2">{feature.icon}</div>
              <div className="text-xs text-surface-400">{feature.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </ScreenContainer>
  );
}
