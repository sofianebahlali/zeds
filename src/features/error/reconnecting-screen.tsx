"use client";

import { motion } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { useUIStore, useConnectionStatus, useRoomStore, usePlayerStore, useGameStore } from "@/stores";
import { useSocket } from "@/hooks";

export function ReconnectingScreen() {
  const { isReconnecting, reconnectAttempts } = useConnectionStatus();
  const setScreen = useUIStore((s) => s.setScreen);
  const room = useRoomStore((s) => s.room);
  const playerId = usePlayerStore((s) => s.playerId);
  const resetGame = useGameStore((s) => s.resetGame);
  const resetRoom = useRoomStore((s) => s.resetRoom);
  const { reconnect, disconnect } = useSocket();

  const handleRetry = () => {
    if (room?.code && playerId) {
      reconnect(room.code, playerId);
    }
  };

  const handleGoHome = () => {
    disconnect();
    resetGame();
    resetRoom();
    setScreen("home");
  };

  const maxAttempts = 5;
  const isFailed = reconnectAttempts >= maxAttempts;

  return (
    <ScreenContainer>
      <div className="w-full max-w-md mx-auto text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          {/* Animated icon */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            {isFailed ? (
              <div className="w-full h-full rounded-full bg-danger-500/20 flex items-center justify-center">
                <WifiOff className="w-12 h-12 text-danger-400" />
              </div>
            ) : (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full bg-warning-500/20"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <div className="relative w-full h-full rounded-full bg-warning-500/20 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="w-12 h-12 text-warning-400" />
                  </motion.div>
                </div>
              </>
            )}
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            {isFailed ? "Connexion perdue" : "Reconnexion..."}
          </h1>
          <p className="text-surface-400">
            {isFailed
              ? "Impossible de se reconnecter au serveur"
              : `Tentative ${reconnectAttempts}/${maxAttempts}`}
          </p>
        </motion.div>

        {/* Connection status dots */}
        {!isFailed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center gap-2 mb-8"
          >
            {Array.from({ length: maxAttempts }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < reconnectAttempts
                    ? "bg-warning-500"
                    : "bg-surface-700"
                }`}
                animate={
                  i === reconnectAttempts
                    ? { scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }
                    : undefined
                }
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {isFailed && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleRetry}
              leftIcon={<RefreshCw className="w-5 h-5" />}
            >
              Réessayer
            </Button>
          )}

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

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-sm text-surface-500"
        >
          <p>Vérifie ta connexion internet</p>
          <p>ou réessaie dans quelques instants</p>
        </motion.div>
      </div>
    </ScreenContainer>
  );
}
