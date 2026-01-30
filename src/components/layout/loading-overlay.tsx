"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores";

export function LoadingOverlay() {
  const isLoading = useUIStore((s) => s.isLoading);
  const loadingMessage = useUIStore((s) => s.loadingMessage);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/80 backdrop-blur-sm"
        >
          <div className="text-center">
            {/* Animated spinner */}
            <div className="relative w-16 h-16 mx-auto mb-4">
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-brand-500/30"
              />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-500"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            </div>
            {loadingMessage && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-surface-300 text-sm"
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
