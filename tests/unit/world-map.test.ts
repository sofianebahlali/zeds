import { describe, it, expect, beforeAll, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  projectX,
  projectY,
  unprojectLng,
  unprojectLat,
  WORLD_VIEW,
  loadWorldShapes,
  countryAtPoint,
  haversineKm as clientHaversine,
  TAP_TOLERANCE_DEG as CLIENT_TOLERANCE,
  type WorldShape,
} from "../../src/lib/world-map";
import {
  countryAt as serverCountryAt,
  haversineKm as serverHaversine,
  loadCountries,
  loadCities,
  TAP_TOLERANCE_DEG as SERVER_TOLERANCE,
} from "../../server/countries";

const GEO_PATH = path.resolve(__dirname, "../../public/geo/world-countries.json");

describe("Mercator projection", () => {
  it("passes longitude through unchanged", () => {
    expect(projectX(0)).toBe(0);
    expect(projectX(-180)).toBe(-180);
    expect(unprojectLng(42)).toBe(42);
  });

  it("puts the equator at y = 0 and flips the sign north of it", () => {
    expect(projectY(0)).toBeCloseTo(0, 9);
    expect(projectY(45)).toBeLessThan(0); // north is up, so negative
    expect(projectY(-45)).toBeGreaterThan(0);
  });

  it("round-trips latitudes inside the rendered band", () => {
    for (const lat of [-55, -30, -10, 0, 10, 30, 55, 75]) {
      expect(unprojectLat(projectY(lat))).toBeCloseTo(lat, 6);
    }
  });

  it("clamps latitudes outside the band instead of blowing up", () => {
    expect(Number.isFinite(projectY(90))).toBe(true);
    expect(Number.isFinite(projectY(-90))).toBe(true);
    // Antarctica is not in the data, so the far south is pinned.
    expect(projectY(-90)).toBe(projectY(-60.2));
  });

  it("is monotonic: further north is always higher on screen", () => {
    const lats = [-60, -30, 0, 30, 60, 80];
    const ys = lats.map(projectY);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeLessThan(ys[i - 1]);
    }
  });

  it("describes a viewport spanning the whole world", () => {
    expect(WORLD_VIEW.x).toBe(-180);
    expect(WORLD_VIEW.width).toBe(360);
    expect(WORLD_VIEW.height).toBeGreaterThan(0);
    expect(WORLD_VIEW.y).toBeCloseTo(projectY(80.1), 6);
  });
});

describe("haversine agrees on both sides of the wire", () => {
  it("returns the same distance client-side and server-side", () => {
    const points: [number, number, number, number][] = [
      [48.85, 2.35, 40.71, -74.01],
      [-33.87, 151.21, 51.51, -0.13],
      [0, 0, 0, 180],
      [35.68, 139.69, 35.68, 139.69],
    ];
    for (const [a, b, c, d] of points) {
      expect(clientHaversine(a, b, c, d)).toBeCloseTo(serverHaversine(a, b, c, d), 9);
    }
  });
});

describe("tap resolution parity", () => {
  let shapes: WorldShape[];

  beforeAll(async () => {
    // The client fetches the same file the server reads off disk.
    const raw = fs.readFileSync(GEO_PATH, "utf-8");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse(raw) }))
    );
    shapes = await loadWorldShapes();
  });

  it("loads every shape with a bounding box and a render path", () => {
    expect(shapes.length).toBeGreaterThan(150);
    for (const s of shapes) {
      expect(s.cca3).toMatch(/^[A-Z]{3}$/);
      expect(s.name).toBeTruthy();
      expect(s.path.startsWith("M")).toBe(true);
      const [minLng, minLat, maxLng, maxLat] = s.bbox;
      expect(minLng).toBeLessThanOrEqual(maxLng);
      expect(minLat).toBeLessThanOrEqual(maxLat);
    }
  });

  it("uses the same tap tolerance on both sides", () => {
    expect(CLIENT_TOLERANCE).toBe(SERVER_TOLERANCE);
  });

  it("highlights the country the server will score — every country capital", () => {
    // The contract in CLAUDE.md: the country under the player's finger must be
    // the one the server scores. Checked against every capital in the dataset.
    const disagreements: string[] = [];
    for (const c of loadCountries()) {
      const client = countryAtPoint(shapes, c.capitalLat, c.capitalLng)?.cca3 ?? null;
      const server = serverCountryAt(c.capitalLat, c.capitalLng)?.cca3 ?? null;
      if (client !== server) {
        disagreements.push(`${c.cca3} @ ${c.capital}: client=${client} server=${server}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("agrees on every city in the 'localise la ville' pool", () => {
    const disagreements: string[] = [];
    for (const city of loadCities()) {
      const client = countryAtPoint(shapes, city.lat, city.lng)?.cca3 ?? null;
      const server = serverCountryAt(city.lat, city.lng)?.cca3 ?? null;
      if (client !== server) {
        disagreements.push(`${city.name}: client=${client} server=${server}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("agrees on a grid of arbitrary points, land and sea alike", () => {
    const disagreements: string[] = [];
    for (let lat = -55; lat <= 75; lat += 5) {
      for (let lng = -175; lng <= 175; lng += 5) {
        const client = countryAtPoint(shapes, lat, lng)?.cca3 ?? null;
        const server = serverCountryAt(lat, lng)?.cca3 ?? null;
        if (client !== server) disagreements.push(`${lat},${lng}: ${client} vs ${server}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("returns nothing over open ocean, on both sides", () => {
    expect(countryAtPoint(shapes, 0, -140)).toBeNull();
    expect(serverCountryAt(0, -140)).toBeNull();
  });
});
