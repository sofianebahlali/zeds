"use client";

import { motion } from "framer-motion";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui";
import { ScreenContainer } from "@/components/layout";
import { cn } from "@/lib/utils";
import { useUIStore, useConnectionStatus, useRoomStore, usePlayerStore, useGameStore } from "@/stores";
import { useSocket } from "@/hooks";
import { clearSessionRoom } from "@/lib/session";

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
    // Forget the room *before* dropping the socket, otherwise the persisted
    // session would silently walk us back into it on the next page load.
    clearSessionRoom();
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
          <div className="relative w-20 h-20 mx-auto mb-6">
            {isFailed ? (
              <div className="w-full h-full rounded-2xl bg-danger-500/15 flex items-center justify-center">
                <WifiOff className="w-10 h-10 text-danger-400" />
              </div>
            ) : (
              <div className="w-full h-full rounded-2xl bg-accent-500/15 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-10 h-10 text-accent-400" />
                </motion.div>
              </div>
            )}
          </div>

          <h1 className="text-2xl font-display font-bold text-surface-100 mb-2">
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
                className={cn(
                  "w-2 h-2 rounded-full",
                  i < reconnectAttempts
                    ? "bg-accent-500"
                    : "bg-surface-700"
                )}
                animate={
                  i === reconnectAttempts
                    ? { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }
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
