"use client";

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { useUIStore, useGameStore, useRoomStore } from "@/stores";

export function ErrorScreen() {
  const error = useUIStore((s) => s.error);
  const setScreen = useUIStore((s) => s.setScreen);
  const setError = useUIStore((s) => s.setError);
  const resetGame = useGameStore((s) => s.resetGame);
  const resetRoom = useRoomStore((s) => s.resetRoom);

  const handleRetry = () => {
    setError(null);
    window.location.reload();
  };

  const handleGoHome = () => {
    setError(null);
    resetGame();
    resetRoom();
    setScreen("home");
  };

  return (
    <ScreenContainer>
      <div className="w-full max-w-md mx-auto text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-danger-500/15 flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-danger-400" />
          </div>

          <h1 className="text-2xl font-display font-bold text-surface-100 mb-2">Oups !</h1>
          <p className="text-surface-400">
            {error || "Une erreur est survenue"}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleRetry}
            leftIcon={<RefreshCw className="w-5 h-5" />}
          >
            Réessayer
          </Button>

          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={handleGoHome}
            leftIcon={<Home className="w-5 h-5" />}
          >
            Retour à l'accueil
          </Button>
        </motion.div>
      </div>
    </ScreenContainer>
  );
}
