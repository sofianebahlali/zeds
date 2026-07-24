"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Maximize2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadWorldShapes,
  countryAtPoint,
  projectX,
  projectY,
  unprojectLat,
  unprojectLng,
  WORLD_VIEW,
  type WorldShape,
} from "@/lib/world-map";

export interface MapPin {
  lat: number;
  lng: number;
  /** Emoji drawn inside the pin — the player's avatar during the reveal. */
  emoji?: string;
  correct?: boolean;
  /** Drawn bigger — used for "my" pin. */
  highlight?: boolean;
  /** The answer itself: a bullseye planted on the exact spot, not a teardrop above it. */
  target?: boolean;
}

interface WorldMapProps {
  /** Country filled as the player's current pick. */
  selectedCca3?: string | null;
  /** Country filled as the right answer (reveal). */
  correctCca3?: string | null;
  pins?: MapPin[];
  /** When provided, tapping the map picks a point. */
  onPick?: (pick: { lat: number; lng: number; cca3: string | null; name: string | null }) => void;
  /** Camera to start on — used at reveal time to zoom onto the answer. */
  focus?: { lat: number; lng: number; span?: number } | null;
  className?: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 60;
/** Finger travel (px) above which a touch counts as a pan, not a tap. */
const TAP_SLOP = 10;

/** Centre of the viewBox, in projected units. */
const VIEW_CX = WORLD_VIEW.x + WORLD_VIEW.width / 2;
const VIEW_CY = WORLD_VIEW.y + WORLD_VIEW.height / 2;

interface View {
  /** Projected coordinates sitting at the centre of the viewport. */
  cx: number;
  cy: number;
  k: number;
}

export function WorldMap({
  selectedCca3,
  correctCca3,
  pins = [],
  onPick,
  focus = null,
  className,
}: WorldMapProps) {
  const [shapes, setShapes] = useState<WorldShape[] | null>(null);
  const [error, setError] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const pinsRef = useRef<SVGGElement>(null);
  const viewRef = useRef<View>({ cx: VIEW_CX, cy: VIEW_CY, k: 1 });

  useEffect(() => {
    let cancelled = false;
    loadWorldShapes()
      .then((s) => !cancelled && setShapes(s))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Camera ────────────────────────────────────────────────
  /** Written straight to the DOM: panning must not re-render 240 paths per frame. */
  const applyTransform = useCallback(() => {
    const { cx, cy, k } = viewRef.current;
    groupRef.current?.setAttribute(
      "transform",
      `translate(${VIEW_CX - cx * k} ${VIEW_CY - cy * k}) scale(${k})`
    );
    // Pins keep a constant on-screen size, so they counter-scale.
    const container = pinsRef.current;
    if (container) {
      for (const child of Array.from(container.children)) {
        const x = Number(child.getAttribute("data-x"));
        const y = Number(child.getAttribute("data-y"));
        const s = Number(child.getAttribute("data-scale")) || 1;
        child.setAttribute("transform", `translate(${x} ${y}) scale(${s / k})`);
      }
    }
  }, []);

  const setView = useCallback(
    (next: View) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next.k));
      const halfW = WORLD_VIEW.width / (2 * k);
      const halfH = WORLD_VIEW.height / (2 * k);
      viewRef.current = {
        k,
        cx: Math.min(WORLD_VIEW.x + WORLD_VIEW.width - halfW, Math.max(WORLD_VIEW.x + halfW, next.cx)),
        cy: Math.min(WORLD_VIEW.y + WORLD_VIEW.height - halfH, Math.max(WORLD_VIEW.y + halfH, next.cy)),
      };
      applyTransform();
    },
    [applyTransform]
  );

  const resetView = useCallback(() => {
    setView({ cx: VIEW_CX, cy: VIEW_CY, k: 1 });
  }, [setView]);

  // Initial camera: whole world, or centred on `focus`.
  useEffect(() => {
    if (!shapes) return;
    if (focus) {
      setView({
        cx: projectX(focus.lng),
        cy: projectY(focus.lat),
        k: WORLD_VIEW.width / (focus.span ?? 60),
      });
    } else {
      resetView();
    }
  }, [shapes, focus, setView, resetView]);

  // Pins are re-created on every render — re-apply their transform afterwards.
  useEffect(applyTransform, [applyTransform, pins, shapes]);

  /** Screen point → projected coordinates. */
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // preserveAspectRatio="xMidYMid meet" letterboxes the drawing inside the element.
    const scale = Math.min(rect.width / WORLD_VIEW.width, rect.height / WORLD_VIEW.height);
    const offsetX = rect.left + (rect.width - WORLD_VIEW.width * scale) / 2;
    const offsetY = rect.top + (rect.height - WORLD_VIEW.height * scale) / 2;
    const vx = WORLD_VIEW.x + (clientX - offsetX) / scale;
    const vy = WORLD_VIEW.y + (clientY - offsetY) / scale;
    const { cx, cy, k } = viewRef.current;
    return { x: (vx - VIEW_CX) / k + cx, y: (vy - VIEW_CY) / k + cy };
  }, []);

  /** Projected units covered by one screen pixel at the current zoom. */
  const worldPerPixel = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 1;
    const scale = Math.min(rect.width / WORLD_VIEW.width, rect.height / WORLD_VIEW.height);
    return 1 / (scale * viewRef.current.k);
  }, []);

  /** Zoom keeping the point under `client` anchored. */
  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const before = viewRef.current;
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, before.k * factor));
      const anchor = clientX !== undefined && clientY !== undefined ? toWorld(clientX, clientY) : null;
      if (anchor) {
        const f = 1 - before.k / k;
        setView({ cx: before.cx + (anchor.x - before.cx) * f, cy: before.cy + (anchor.y - before.cy) * f, k });
      } else {
        setView({ ...before, k });
      }
    },
    [setView, toWorld]
  );

  // ── Gestures ──────────────────────────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; startTime: number; pinched: boolean; pinchDist: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const list = Array.from(pointers.current.values());
    const pinching = list.length >= 2;
    gesture.current = {
      moved: gesture.current?.moved ?? 0,
      startTime: gesture.current?.startTime ?? Date.now(),
      pinched: pinching || (gesture.current?.pinched ?? false),
      pinchDist: pinching ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);

    const list = Array.from(pointers.current.values());
    if (list.length >= 2) {
      const dist = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      const cx = (list[0].x + list[1].x) / 2;
      const cy = (list[0].y + list[1].y) / 2;
      if (gesture.current.pinchDist > 0) zoomAt(dist / gesture.current.pinchDist, cx, cy);
      gesture.current.pinchDist = dist;
      gesture.current.pinched = true;
      return;
    }

    const perPixel = worldPerPixel();
    setView({
      ...viewRef.current,
      cx: viewRef.current.cx - (e.clientX - prev.x) * perPixel,
      cy: viewRef.current.cy - (e.clientY - prev.y) * perPixel,
    });
  };

  const endPointer = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (!g) return;

    if (pointers.current.size === 0) {
      const wasTap = !g.pinched && g.moved < TAP_SLOP && Date.now() - g.startTime < 700;
      if (wasTap && onPick && shapes) {
        const world = toWorld(e.clientX, e.clientY);
        if (world) {
          const lat = unprojectLat(world.y);
          const lng = unprojectLng(world.x);
          const hit = countryAtPoint(shapes, lat, lng);
          onPick({ lat, lng, cca3: hit?.cca3 ?? null, name: hit?.name ?? null });
        }
      }
      gesture.current = null;
    } else {
      // One finger lifted mid-pinch: the remaining one must not jump the map.
      g.pinchDist = 0;
      g.moved = TAP_SLOP;
    }
  };

  // Wheel must be non-passive to stop the page scrolling under the map.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.25 : 1 / 1.25, e.clientX, e.clientY);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [zoomAt]);

  // ── Render ────────────────────────────────────────────────
  const paths = useMemo(() => {
    if (!shapes) return null;
    return shapes.map((shape) => {
      const isSelected = shape.cca3 === selectedCca3;
      const isCorrect = shape.cca3 === correctCca3;
      return (
        <path
          key={shape.cca3}
          d={shape.path}
          className={cn(
            "transition-colors duration-200",
            isCorrect ? "fill-success-500" : isSelected ? "fill-brand-500" : "fill-surface-700"
          )}
          stroke={isCorrect || isSelected ? "#F0ECE6" : "#12110F"}
          strokeWidth={isCorrect || isSelected ? 1.5 : 0.4}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      );
    });
  }, [shapes, selectedCca3, correctCca3]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-[#0B1620] border border-surface-800",
        className
      )}
    >
      {!shapes && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-surface-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-surface-400">
          Carte indisponible — vérifie ta connexion.
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`${WORLD_VIEW.x} ${WORLD_VIEW.y} ${WORLD_VIEW.width} ${WORLD_VIEW.height}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn("w-full h-full select-none", onPick && "cursor-crosshair")}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <g ref={groupRef}>
          {paths}
          <g ref={pinsRef}>
            {pins.map((pin, i) => (
              <g
                key={`${pin.lat}-${pin.lng}-${i}`}
                data-x={projectX(pin.lng)}
                data-y={projectY(pin.lat)}
                data-scale={pin.highlight ? 1.25 : 1}
              >
                {pin.target ? (
                  <>
                    <circle r={9} className="fill-accent-400/25" />
                    <circle r={5} fill="none" stroke="#F0ECE6" strokeWidth={1.5} />
                    <circle r={2} className="fill-accent-300" />
                  </>
                ) : (
                  <>
                    <path
                      d="M 0 1 L -3.5 -5 L 3.5 -5 Z"
                      className={
                        pin.correct === true
                          ? "fill-success-400"
                          : pin.correct === false
                          ? "fill-danger-400"
                          : "fill-brand-400"
                      }
                    />
                    <circle
                      cy={-11}
                      r={7.5}
                      className={
                        pin.correct === true
                          ? "fill-success-500"
                          : pin.correct === false
                          ? "fill-danger-500"
                          : "fill-brand-500"
                      }
                      stroke="#F0ECE6"
                      strokeWidth={1.5}
                    />
                    {pin.emoji ? (
                      <text textAnchor="middle" y={-8} fontSize={9}>
                        {pin.emoji}
                      </text>
                    ) : (
                      <circle cy={-11} r={2.5} fill="#F0ECE6" />
                    )}
                  </>
                )}
              </g>
            ))}
          </g>
        </g>
      </svg>

      <div className="absolute bottom-2 right-2 flex flex-col gap-1.5">
        <MapButton label="Zoom avant" onClick={() => zoomAt(1.8)}>
          <Plus className="w-5 h-5" />
        </MapButton>
        <MapButton label="Zoom arrière" onClick={() => zoomAt(1 / 1.8)}>
          <Minus className="w-5 h-5" />
        </MapButton>
        <MapButton label="Vue monde" onClick={resetView}>
          <Maximize2 className="w-4 h-4" />
        </MapButton>
      </div>
    </div>
  );
}

function MapButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-900/90 border border-surface-700 text-surface-200 active:bg-surface-800 backdrop-blur-sm"
    >
      {children}
    </button>
  );
}
