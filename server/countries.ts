/**
 * Country data for the geography modes (drapeau / capitale / localisation).
 *
 * All three files are produced by `npx tsx scripts/build-countries.ts`:
 *  - data/questions/countries.json   → the pool of countries
 *  - data/questions/cities.json      → the pool of cities ("localise la ville")
 *  - public/geo/world-countries.json → the same shapes the client map renders,
 *    so a tap is resolved to a country identically on both sides.
 */

import * as fs from "fs";
import * as path from "path";
import type { GeoDifficulty } from "../src/types";

export interface CountryRecord {
  cca2: string;
  cca3: string;
  nameFr: string;
  nameEn: string;
  aliases: string[];
  capital: string;
  capitalAliases: string[];
  capitalLat: number;
  capitalLng: number;
  continent: string;
  population: number;
  lat: number;
  lng: number;
  flagFile: string;
  difficulty: GeoDifficulty;
  locateDifficulty: GeoDifficulty | null;
}

export interface CityRecord {
  name: string;
  cca3: string;
  countryName: string;
  flagFile: string;
  continent: string;
  lat: number;
  lng: number;
  population: number;
  isCapital: boolean;
  difficulty: GeoDifficulty;
}

type Ring = [number, number][];
type Poly = Ring[];

interface WorldFeature {
  id: string;
  properties: { name: string };
  geometry: { type: "MultiPolygon"; coordinates: Poly[] };
}

interface IndexedShape {
  cca3: string;
  name: string;
  polys: Poly[];
  /** [minLng, minLat, maxLng, maxLat] — cheap rejection before the ray cast. */
  bbox: [number, number, number, number];
}

let countriesCache: CountryRecord[] | null = null;
let citiesCache: CityRecord[] | null = null;
let shapesCache: IndexedShape[] | null = null;

/** Bounding-box area in deg² — only used to order shapes, never as a real area. */
function bboxSize(b: [number, number, number, number]): number {
  return (b[2] - b[0]) * (b[3] - b[1]);
}

/**
 * A tap this far outside a border still counts as inside it. The shapes are
 * simplified, so coastal cities (Manhattan, Naples…) sit slightly "in the sea".
 * The client applies the exact same tolerance, so highlight and score agree.
 */
export const TAP_TOLERANCE_DEG = 0.6;

export function loadCountries(): CountryRecord[] {
  if (countriesCache) return countriesCache;
  const filePath = path.resolve(__dirname, "../data/questions/countries.json");
  try {
    countriesCache = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CountryRecord[];
  } catch {
    console.warn("No countries data found at", filePath);
    countriesCache = [];
  }
  return countriesCache;
}

export function loadCities(): CityRecord[] {
  if (citiesCache) return citiesCache;
  const filePath = path.resolve(__dirname, "../data/questions/cities.json");
  try {
    citiesCache = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CityRecord[];
  } catch {
    console.warn("No cities data found at", filePath);
    citiesCache = [];
  }
  return citiesCache;
}

function loadShapes(): IndexedShape[] {
  if (shapesCache) return shapesCache;
  const filePath = path.resolve(__dirname, "../public/geo/world-countries.json");
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { features: WorldFeature[] };
    shapesCache = raw.features.map((f) => {
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;
      for (const poly of f.geometry.coordinates) {
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
      };
    });
    // Smallest first: the Vatican must win over Italy, Lesotho over South Africa.
    shapesCache.sort((a, b) => bboxSize(a.bbox) - bboxSize(b.bbox));
  } catch {
    console.warn("No world geometry found at", filePath);
    shapesCache = [];
  }
  return shapesCache;
}

/**
 * Countries usable for "localise le pays": they need a shape on the map, and that
 * shape must be big enough to aim at (a Vatican-sized target is not a game).
 */
export function loadLocatableCountries(): CountryRecord[] {
  const MIN_SPAN_DEG = 0.3;
  const tappable = new Set(
    loadShapes()
      .filter((s) => Math.max(s.bbox[2] - s.bbox[0], s.bbox[3] - s.bbox[1]) >= MIN_SPAN_DEG)
      .map((s) => s.cca3)
  );
  return loadCountries().filter((c) => c.locateDifficulty !== null && tappable.has(c.cca3));
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

/** Squared distance (deg²) from a point to a ring's outline. */
function distSqToRing(lng: number, lat: number, ring: Ring): number {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((lng - x1) * dx + (lat - y1) * dy) / lenSq));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const d = (lng - px) ** 2 + (lat - py) ** 2;
    if (d < best) best = d;
  }
  return best;
}

/**
 * Which country was tapped? Exact containment first, then the closest border
 * within TAP_TOLERANCE_DEG so that coastal taps are not punished by the
 * simplified outlines. `null` over open sea.
 */
export function countryAt(lat: number, lng: number): { cca3: string; name: string } | null {
  const shapes = loadShapes();
  for (const shape of shapes) {
    const [minLng, minLat, maxLng, maxLat] = shape.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    for (const poly of shape.polys) {
      if (!pointInRing(lng, lat, poly[0])) continue;
      // Rings after the first are holes (Lesotho inside South Africa, …)
      let inHole = false;
      for (let i = 1; i < poly.length; i++) {
        if (pointInRing(lng, lat, poly[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return { cca3: shape.cca3, name: shape.name };
    }
  }

  const tol = TAP_TOLERANCE_DEG;
  let nearest: IndexedShape | null = null;
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
  return nearest ? { cca3: nearest.cca3, name: nearest.name } : null;
}

/** Great-circle distance in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Difficulty ramp across a mode segment: start gentle, finish hard.
 * 1 round → easy, 2 → easy+medium, 3 → easy/medium/hard, then proportional.
 */
export function difficultyRamp(count: number): GeoDifficulty[] {
  if (count <= 1) return ["easy"];
  if (count === 2) return ["easy", "medium"];
  if (count === 3) return ["easy", "medium", "hard"];
  return Array.from({ length: count }, (_, i) => {
    const p = i / count;
    return p < 0.34 ? "easy" : p < 0.7 ? "medium" : "hard";
  });
}

/**
 * Pick `count` entries following the difficulty ramp, without repeats.
 * Falls back to a neighbouring tier when the requested one runs dry.
 */
export function pickByDifficultyRamp<T>(
  pool: T[],
  count: number,
  tierOf: (item: T) => GeoDifficulty | null,
  keyOf: (item: T) => string
): T[] {
  const buckets: Record<GeoDifficulty, T[]> = { easy: [], medium: [], hard: [] };
  for (const c of pool) {
    const tier = tierOf(c);
    if (tier) buckets[tier].push(c);
  }
  for (const tier of ["easy", "medium", "hard"] as const) {
    buckets[tier].sort(() => Math.random() - 0.5);
  }

  const picked: T[] = [];
  const used = new Set<string>();
  const takeFrom = (tier: GeoDifficulty): T | null => {
    while (buckets[tier].length) {
      const c = buckets[tier].pop()!;
      if (!used.has(keyOf(c))) return c;
    }
    return null;
  };

  for (const tier of difficultyRamp(count)) {
    // Try the requested tier, then neighbouring ones, so a short bucket never blocks a round.
    const order: GeoDifficulty[] =
      tier === "easy" ? ["easy", "medium", "hard"] : tier === "medium" ? ["medium", "easy", "hard"] : ["hard", "medium", "easy"];
    let chosen: T | null = null;
    for (const t of order) {
      chosen = takeFrom(t);
      if (chosen) break;
    }
    if (!chosen) break;
    used.add(keyOf(chosen));
    picked.push(chosen);
  }
  return picked;
}

export const GEO_POINTS: Record<GeoDifficulty, number> = { easy: 100, medium: 150, hard: 200 };
export const LOCATE_POINTS: Record<GeoDifficulty, number> = { easy: 150, medium: 200, hard: 250 };
export const CITY_POINTS: Record<GeoDifficulty, number> = { easy: 150, medium: 200, hard: 250 };

/**
 * "Localise la ville" scoring, in kilometres. A tap inside PERFECT_KM is a bullseye;
 * past that the score decays and dies out at DECAY_KM.
 */
export const CITY_PERFECT_KM = 75;
export const CITY_DECAY_KM = 1200;
/** Landing in the right country is worth something even when the pin is far off. */
export const CITY_COUNTRY_FLOOR = 0.25;

/** Fraction of the round's points earned by a pin `distanceKm` from the city. */
export function cityProximityRatio(distanceKm: number, sameCountry: boolean): number {
  const ratio =
    distanceKm <= CITY_PERFECT_KM
      ? 1
      : Math.max(0, 1 - (distanceKm - CITY_PERFECT_KM) / CITY_DECAY_KM) ** 2;
  return sameCountry ? Math.max(ratio, CITY_COUNTRY_FLOOR) : ratio;
}

// ==========================================
// ANSWER MATCHING
// ==========================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’ʻ'`]/g, "'")
    .replace(/[-–]/g, " ")
    .replace(/\s+/g, " ");
}

/** Damerau-Levenshtein — swapped letters ("Frnace") count as a single mistake. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1);
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(rows[i - 1][j] + 1, cur[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], rows[i - 2][j - 2] + 1);
      }
    }
    rows.push(cur);
  }
  return rows[a.length][b.length];
}

/**
 * How many mistakes we forgive, by length of the expected answer. Short names get
 * no slack at all — "Irak" and "Iran" are one edit apart and both exist.
 */
function allowedMistakes(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  if (len <= 12) return 2;
  return 3;
}

/** normalized name → set of cca3 that legitimately answer to it. */
let countryNameIndex: Map<string, Set<string>> | null = null;
let capitalNameIndex: Map<string, Set<string>> | null = null;

function buildIndexes(): void {
  if (countryNameIndex && capitalNameIndex) return;
  countryNameIndex = new Map();
  capitalNameIndex = new Map();
  const add = (index: Map<string, Set<string>>, name: string, cca3: string) => {
    const key = normalize(name);
    if (!key) return;
    const set = index.get(key) || new Set<string>();
    set.add(cca3);
    index.set(key, set);
  };
  for (const c of loadCountries()) {
    for (const n of [c.nameFr, c.nameEn, ...c.aliases]) add(countryNameIndex, n, c.cca3);
    for (const n of [c.capital, ...c.capitalAliases]) add(capitalNameIndex, n, c.cca3);
  }
}

/**
 * Typo-tolerant matching that refuses to "fix" an answer into a different country:
 * "Irak" is never accepted for Iran, "Gambie" never for Zambie, even though the
 * edit distance is 1. Only genuine typos (a word nobody else owns) are forgiven.
 */
function matchAgainst(
  input: string,
  accepted: string[],
  index: Map<string, Set<string>>,
  cca3: string
): boolean {
  const guess = normalize(input);
  if (guess.length < 2) return false;

  const targets = accepted.map(normalize).filter(Boolean);
  if (targets.includes(guess)) return true;

  // The guess is somebody else's actual name → wrong, no matter how close it looks.
  const owners = index.get(guess);
  if (owners && !owners.has(cca3)) return false;

  return targets.some((t) => editDistance(guess, t) <= allowedMistakes(t.length));
}

/** Does `input` name the country `cca3`? `accepted` holds its name and aliases. */
export function matchesCountryName(input: string, cca3: string, accepted: string[]): boolean {
  buildIndexes();
  return matchAgainst(input, accepted, countryNameIndex!, cca3);
}

/** Does `input` name the capital of `cca3`? `accepted` holds the capital and its aliases. */
export function matchesCapitalName(input: string, cca3: string, accepted: string[]): boolean {
  buildIndexes();
  return matchAgainst(input, accepted, capitalNameIndex!, cca3);
}
