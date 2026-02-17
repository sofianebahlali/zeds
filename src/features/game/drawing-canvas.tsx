"use client";

import React, { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { cn } from "@/lib/utils";

const COLORS = [
  "#000000", "#FFFFFF", "#808080", "#C0C0C0",
  "#FF0000", "#FF6B6B", "#FF4500", "#8B0000",
  "#FF8C00", "#FFA500", "#FFD700", "#FFFF00",
  "#00FF00", "#228B22", "#006400", "#90EE90",
  "#0000FF", "#1E90FF", "#00BFFF", "#000080",
  "#800080", "#FF00FF", "#FF69B4", "#8B4513",
];

const BRUSH_SIZES = [2, 5, 10, 16, 24];
const ERASER_SIZES = [12, 24, 40];

type Tool = "pencil" | "eraser" | "fill";

export interface DrawingCanvasHandle {
  exportAsBase64: () => string;
  clear: () => void;
}

interface DrawingCanvasProps {
  disabled?: boolean;
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  ({ disabled = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    const [tool, setTool] = useState<Tool>("pencil");
    const [color, setColor] = useState("#000000");
    const [brushSize, setBrushSize] = useState(5);
    const [eraserSize, setEraserSize] = useState(24);

    const undoStackRef = useRef<ImageData[]>([]);
    const redoStackRef = useRef<ImageData[]>([]);
    const [undoCount, setUndoCount] = useState(0);
    const [redoCount, setRedoCount] = useState(0);
    const MAX_UNDO = 25;

    const saveSnapshot = useCallback(() => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStackRef.current.push(snapshot);
      if (undoStackRef.current.length > MAX_UNDO) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setUndoCount(undoStackRef.current.length);
      setRedoCount(0);
    }, []);

    const initCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.scale(dpr, dpr);
      ctxRef.current = ctx;

      // White background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, rect.width, rect.height);

      undoStackRef.current = [];
      redoStackRef.current = [];
      saveSnapshot();
    }, [saveSnapshot]);

    useEffect(() => {
      initCanvas();
    }, [initCanvas]);

    // Block native touch gestures (scroll, pull-to-refresh, pan) on the canvas container
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const preventTouch = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          e.preventDefault();
        }
      };

      // Must be { passive: false } to allow preventDefault on touchmove
      container.addEventListener("touchmove", preventTouch, { passive: false });
      container.addEventListener("touchstart", preventTouch, { passive: false });

      return () => {
        container.removeEventListener("touchmove", preventTouch);
        container.removeEventListener("touchstart", preventTouch);
      };
    }, []);

    const getCanvasPoint = useCallback((e: React.PointerEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }, []);

    // Flood fill
    const floodFill = useCallback((startX: number, startY: number, fillColorHex: string) => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelX = Math.floor(startX * dpr);
      const pixelY = Math.floor(startY * dpr);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      const getIdx = (x: number, y: number) => (y * width + x) * 4;

      const targetIdx = getIdx(pixelX, pixelY);
      const targetR = data[targetIdx], targetG = data[targetIdx + 1], targetB = data[targetIdx + 2], targetA = data[targetIdx + 3];

      // Parse fill color
      const r = parseInt(fillColorHex.slice(1, 3), 16);
      const g = parseInt(fillColorHex.slice(3, 5), 16);
      const b = parseInt(fillColorHex.slice(5, 7), 16);

      // Don't fill if same color
      if (targetR === r && targetG === g && targetB === b && targetA === 255) return;

      const tolerance = 32;
      const matchesTarget = (idx: number) => {
        return Math.abs(data[idx] - targetR) <= tolerance &&
               Math.abs(data[idx + 1] - targetG) <= tolerance &&
               Math.abs(data[idx + 2] - targetB) <= tolerance &&
               Math.abs(data[idx + 3] - targetA) <= tolerance;
      };

      const stack: number[] = [pixelX, pixelY];
      const visited = new Uint8Array(width * height);

      while (stack.length > 0) {
        const y = stack.pop()!;
        const x = stack.pop()!;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const vIdx = y * width + x;
        if (visited[vIdx]) continue;

        const idx = vIdx * 4;
        if (!matchesTarget(idx)) continue;

        visited[vIdx] = 1;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;

        stack.push(x + 1, y);
        stack.push(x - 1, y);
        stack.push(x, y + 1);
        stack.push(x, y - 1);
      }

      ctx.putImageData(imageData, 0, 0);
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.setPointerCapture(e.pointerId);
      const point = getCanvasPoint(e);

      if (tool === "fill") {
        floodFill(point.x, point.y, color);
        saveSnapshot();
        return;
      }

      isDrawingRef.current = true;
      lastPointRef.current = point;

      // Draw a dot for single taps
      const ctx = ctxRef.current;
      if (ctx) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, (tool === "eraser" ? eraserSize : brushSize) / 2, 0, Math.PI * 2);
        ctx.fillStyle = tool === "eraser" ? "#FFFFFF" : color;
        ctx.fill();
      }
    }, [disabled, tool, color, brushSize, eraserSize, getCanvasPoint, floodFill, saveSnapshot]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (!isDrawingRef.current || disabled) return;
      e.preventDefault();

      const point = getCanvasPoint(e);
      const ctx = ctxRef.current;
      if (!ctx || !lastPointRef.current) return;

      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color;
      ctx.lineWidth = tool === "eraser" ? eraserSize : brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      lastPointRef.current = point;
    }, [disabled, tool, color, brushSize, eraserSize, getCanvasPoint]);

    const handlePointerUp = useCallback(() => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        lastPointRef.current = null;
        saveSnapshot();
      }
    }, [saveSnapshot]);

    const undo = useCallback(() => {
      if (undoStackRef.current.length <= 1) return;
      const current = undoStackRef.current.pop()!;
      redoStackRef.current.push(current);
      const prev = undoStackRef.current[undoStackRef.current.length - 1];
      ctxRef.current?.putImageData(prev, 0, 0);
      setUndoCount(undoStackRef.current.length);
      setRedoCount(redoStackRef.current.length);
    }, []);

    const redo = useCallback(() => {
      if (redoStackRef.current.length === 0) return;
      const next = redoStackRef.current.pop()!;
      undoStackRef.current.push(next);
      ctxRef.current?.putImageData(next, 0, 0);
      setUndoCount(undoStackRef.current.length);
      setRedoCount(redoStackRef.current.length);
    }, []);

    const clearCanvas = useCallback(() => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!ctx || !canvas || !container) return;

      const rect = container.getBoundingClientRect();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, rect.width, rect.height);
      saveSnapshot();
    }, [saveSnapshot]);

    const exportAsBase64 = useCallback((): string => {
      const canvas = canvasRef.current;
      if (!canvas) return "";
      return canvas.toDataURL("image/jpeg", 0.7);
    }, []);

    useImperativeHandle(ref, () => ({
      exportAsBase64,
      clear: clearCanvas,
    }), [exportAsBase64, clearCanvas]);

    const currentSizes = tool === "eraser" ? ERASER_SIZES : BRUSH_SIZES;
    const currentSize = tool === "eraser" ? eraserSize : brushSize;

    return (
      <div className="flex flex-col h-full" style={{ touchAction: "none", overscrollBehavior: "none" }}>
        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 relative bg-white rounded-xl overflow-hidden mx-1"
          style={{ touchAction: "none", overscrollBehavior: "none" }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {disabled && (
            <div className="absolute inset-0 bg-surface-950/30 flex items-center justify-center rounded-xl">
              <span className="text-surface-300 font-semibold text-lg">Dessin verrouillé</span>
            </div>
          )}
        </div>

        {/* Toolbar - BOTTOM */}
        {!disabled && (
          <div className="bg-surface-900 border-t border-surface-800 mt-1 rounded-b-xl">
            {/* Color palette */}
            <div className="flex gap-1 px-2 py-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); if (tool === "eraser" || tool === "fill") setTool("pencil"); }}
                  className={cn(
                    "w-7 h-7 rounded-full shrink-0 transition-transform",
                    color === c && tool === "pencil"
                      ? "ring-2 ring-brand-400 ring-offset-1 ring-offset-surface-900 scale-110"
                      : "border border-surface-700"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Tools + sizes + actions */}
            <div className="flex items-center justify-between px-2 py-1.5 gap-1 border-t border-surface-800">
              {/* Tools */}
              <div className="flex gap-1">
                <ToolBtn active={tool === "pencil"} onClick={() => setTool("pencil")} label="✏️" />
                <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="🧹" />
                <ToolBtn active={tool === "fill"} onClick={() => setTool("fill")} label="🪣" />
              </div>

              {/* Sizes */}
              {tool !== "fill" && (
                <div className="flex gap-1 items-center">
                  {currentSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => tool === "eraser" ? setEraserSize(size) : setBrushSize(size)}
                      className={cn(
                        "w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center",
                        currentSize === size && "ring-2 ring-brand-400"
                      )}
                    >
                      <div
                        className="rounded-full bg-surface-200"
                        style={{ width: Math.min(size, 20), height: Math.min(size, 20) }}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Undo/Redo/Clear */}
              <div className="flex gap-1">
                <ToolBtn onClick={undo} label="↩️" disabled={undoCount <= 1} />
                <ToolBtn onClick={redo} label="↪️" disabled={redoCount === 0} />
                <ToolBtn onClick={clearCanvas} label="🗑️" danger />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";

function ToolBtn({ active, onClick, label, disabled, danger }: {
  active?: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors",
        "disabled:opacity-30",
        active
          ? "bg-brand-500/20 ring-2 ring-brand-400"
          : danger
          ? "bg-danger-500/10 hover:bg-danger-500/20"
          : "bg-surface-800 hover:bg-surface-700"
      )}
    >
      {label}
    </button>
  );
}
