"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useGameStore } from "@/stores";
import { useSocket } from "@/hooks";
import { formatTime } from "@/lib/utils";
import { DrawingCanvas, type DrawingCanvasHandle } from "./drawing-canvas";

export function DrawingPhaseScreen() {
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const drawingPhrase = useGameStore((s) => s.drawingPhrase);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const { submitDrawing } = useSocket();
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const autoSubmittedRef = useRef(false);

  // Auto-submit drawing shortly before timer expires to avoid race condition
  // with server phase transition (server moves to guessing at timeRemaining=0)
  useEffect(() => {
    if (timeRemaining <= 1 && !hasAnswered && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      const base64 = canvasRef.current?.exportAsBase64();
      if (base64) {
        submitDrawing(base64);
      }
    }
  }, [timeRemaining, hasAnswered, submitDrawing]);

  // Reset auto-submit flag when phase changes
  useEffect(() => {
    autoSubmittedRef.current = false;
  }, [drawingPhrase]);

  const handleSubmit = () => {
    if (hasAnswered) return;
    const base64 = canvasRef.current?.exportAsBase64();
    if (base64) {
      submitDrawing(base64);
    }
  };

  return (
    <motion.div
      className="flex flex-col h-full overflow-hidden"
      style={{ touchAction: "none", overscrollBehavior: "none" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Timer + Phrase */}
      <div className="px-4 pt-2 pb-1 space-y-2">
        {/* Timer bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-500 rounded-full"
              animate={{ width: `${Math.max(0, (timeRemaining / 60) * 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-sm font-mono font-bold text-surface-300 w-12 text-right">
            {formatTime(timeRemaining)}
          </span>
        </div>

        {/* Phrase to draw */}
        {drawingPhrase && (
          <div className="text-center">
            <Badge variant="primary" size="lg" className="text-base px-4 py-1">
              Dessine : {drawingPhrase}
            </Badge>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 px-1 pb-1">
        <DrawingCanvas ref={canvasRef} disabled={hasAnswered} />
      </div>

      {/* Submit / Waiting */}
      <div className="px-4 pb-4 pb-safe-bottom">
        {!hasAnswered ? (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
          >
            <Send className="w-4 h-4" />
            Envoyer mon dessin
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3">
            <CheckCircle className="w-5 h-5 text-success-400" />
            <span className="text-success-400 font-semibold">Dessin envoyé ! En attente des autres...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
