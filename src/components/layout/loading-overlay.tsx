"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores";

const LOADING_TIMEOUT_MS = 10_000;

export function LoadingOverlay() {
  const isLoading = useUIStore((s) => s.isLoading);
  const loadingMessage = useUIStore((s) => s.loadingMessage);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = useRef<number>(0);

  // Safety net: auto-dismiss loading after timeout so the UI never freezes.
  useEffect(() => {
    const giveUp = () => {
      useUIStore.getState().setLoading(false);
      useUIStore.getState().addNotification({
        type: "error",
        message: "La connexion a pris trop de temps. Réessaie.",
        duration: 5000,
      });
    };

    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    // Mobile browsers freeze timers in background tabs, so the timeout alone
    // can't be trusted — re-check against a wall-clock deadline whenever the
    // page comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!useUIStore.getState().isLoading) return;
      if (Date.now() >= deadlineRef.current) {
        clear();
        giveUp();
      }
    };

    if (isLoading) {
      deadlineRef.current = Date.now() + LOADING_TIMEOUT_MS;
      timerRef.current = setTimeout(giveUp, LOADING_TIMEOUT_MS);
      document.addEventListener("visibilitychange", onVisible);
    } else {
      clear();
    }

    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // The node stays mounted for the exit animation, and framer-motion
          // drives that from requestAnimationFrame — which mobile browsers
          // pause on backgrounding, scroll jank or low-power mode. A stalled
          // exit left this invisible full-screen layer swallowing every tap
          // ("plus rien n'est cliquable"). Stop capturing pointers the moment
          // loading is over, whatever the animation does.
          style={{ pointerEvents: isLoading ? "auto" : "none" }}
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
