"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores";

const LOADING_TIMEOUT_MS = 10_000;

export function LoadingOverlay() {
  const isLoading = useUIStore((s) => s.isLoading);
  const loadingMessage = useUIStore((s) => s.loadingMessage);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety net: auto-dismiss loading after timeout so the UI never freezes.
  useEffect(() => {
    if (isLoading) {
      timerRef.current = setTimeout(() => {
        useUIStore.getState().setLoading(false);
        useUIStore.getState().addNotification({
          type: "error",
          message: "La connexion a pris trop de temps. Réessaie.",
          duration: 5000,
        });
      }, LOADING_TIMEOUT_MS);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/90"
        >
          <div className="text-center">
            <motion.div
              className="w-8 h-8 mx-auto mb-4 border-2 border-surface-700 border-t-brand-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            {loadingMessage && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-surface-400 text-sm"
              >
                {loadingMessage}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
