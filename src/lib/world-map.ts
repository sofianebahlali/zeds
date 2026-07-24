/**
 * World geometry for the "Localise le pays" mode.
 *
 * Loads `/geo/world-countries.json` (built by scripts/build-countries.ts) and
 * resolves a tap to a country. The hit-test mirrors `server/countries.ts` exactly —
 * same shapes, same tolerance — so the country highlighted under the player's finger
 * is the one the server scores.
 *
 * Projection is Web Mercator expressed in "degree" units: x = lng, y = -mercator(lat).
 * Mercator gives a portrait-friendly world (360 × 216 instead of 360 × 144) and blows
 * up the small European countries, which makes them tappable with a thumb.
 */

type Ring = [number, number][];
type Poly = Ring[];

export interface WorldShape {
  cca3: string;
  name: string;
  polys: Poly[];
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  /** SVG path in projected units */
  path: string;
}

/** A tap this far outside a border still counts as inside it. Keep in sync with the server. */
export const TAP_TOLERANCE_DEG = 0.6;

/** Latitudes outside this band are clamped (Antarctica is not part of the data). */
const MAX_LAT = 80.1;
const MIN_LAT = -60.2;

export const projectX = (lng: number) => lng;

export function projectY(lat: number): number {
  const clamped = Math.min(MAX_LAT, Math.max(MIN_LAT, lat));
  return -(180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
}

export const unprojectLng = (x: number) => x;

export function unprojectLat(y: number): number {
  return (360 / Math.PI) * Math.atan(Math.exp((-y * Math.PI) / 180)) - 90;
}

/** Visible world window, in projected units. */
export const WORLD_VIEW = {
  x: -180,
  y: projectY(MAX_LAT),
  width: 360,
  height: projectY(MIN_LAT) - projectY(MAX_LAT),
};

let cache: Promise<WorldShape[]> | null = null;

export function loadWorldShapes(): Promise<WorldShape[]> {
  if (!cache) {
    cache = fetch("/geo/world-countries.json")
      .then((res) => {
        if (!res.ok) throw new Error(`world geometry: ${res.status}`);
        return res.json();
      })
      .then((geo: { features: { id: string; properties: { name: string }; geometry: { coordinates: Poly[] } }[] }) => {
        const shapes = geo.features.map((f) => {
          let minLng = Infinity;
          let minLat = Infinity;
          let maxLng = -Infinity;
          let maxLat = -Infinity;
          let path = "";
          for (const poly of f.geometry.coordinates) {
            for (const ring of poly) {
              path += "M";
              for (let i = 0; i < ring.length; i++) {
                const [lng, lat] = ring[i];
                path += `${i ? "L" : ""}${projectX(lng)} ${projectY(lat)}`;
              }
              path += "Z";
            }
            for (const [lng, lat] of poly[0]) {
              if (lng < minLng) minLng = lng;
              if (lat < minLat) minLat = lat;
              if (lng > maxLng) maxLng = lng;
              if (lat > maxLat) maxLat = lat;
            }
          }
          return {
            cca3: f.id,
            name: f.properties.name,
            polys: f.geometry.coordinates,
            bbox: [minLng, minLat, maxLng, maxLat] as [number, number, number, number],
            path,
          };
        });
        // Smallest first so a micro-state wins over the country around it.
        return shapes.sort(
          (a, b) =>
            (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) -
            (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1])
        );
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distSqToRing(lng: number, lat: number, ring: Ring): number {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((lng - x1) * dx + (lat - y1) * dy) / lenSq));
    const d = (lng - (x1 + t * dx)) ** 2 + (lat - (y1 + t * dy)) ** 2;
    if (d < best) best = d;
  }
  return best;
}

/** Country under this point, or the closest one within the tap tolerance. */
export function countryAtPoint(shapes: WorldShape[], lat: number, lng: number): WorldShape | null {
  for (const shape of shapes) {
    const [minLng, minLat, maxLng, maxLat] = shape.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    for (const poly of shape.polys) {
      if (!pointInRing(lng, lat, poly[0])) continue;
      let inHole = false;
      for (let i = 1; i < poly.length; i++) {
        if (pointInRing(lng, lat, poly[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return shape;
    }
  }

  const tol = TAP_TOLERANCE_DEG;
  let nearest: WorldShape | null = null;
  let nearestDistSq = tol * tol;
  for (const shape of shapes) {
    const [minLng, minLat, maxLng, maxLat] = shape.bbox;
    if (lng < minLng - tol || lng > maxLng + tol || lat < minLat - tol || lat > maxLat + tol) continue;
    for (const poly of shape.polys) {
      const d = distSqToRing(lng, lat, poly[0]);
      if (d < nearestDistSq) {
        nearestDistSq = d;
        nearest = shape;
      }
    }
  }
  return nearest;
}

/** Great-circle distance in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
