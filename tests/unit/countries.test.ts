import { describe, it, expect } from "vitest";
import {
  loadCountries,
  loadCities,
  loadLocatableCountries,
  countryAt,
  haversineKm,
  difficultyRamp,
  pickByDifficultyRamp,
  cityProximityRatio,
  matchesCountryName,
  matchesCapitalName,
  CITY_PERFECT_KM,
  CITY_COUNTRY_FLOOR,
  TAP_TOLERANCE_DEG,
} from "../../server/countries";

describe("country dataset", () => {
  it("ships the full pool with the fields the geo modes need", () => {
    const countries = loadCountries();
    expect(countries.length).toBeGreaterThanOrEqual(190);

    for (const c of countries) {
      expect(c.cca3).toMatch(/^[A-Z]{3}$/);
      expect(c.nameFr).toBeTruthy();
      expect(c.capital).toBeTruthy();
      expect(c.flagFile).toMatch(/\.(png|svg|webp)$/);
      expect(["easy", "medium", "hard"]).toContain(c.difficulty);
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lng)).toBeLessThanOrEqual(180);
    }
  });

  it("has no duplicate country codes", () => {
    const codes = loadCountries().map((c) => c.cca3);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("ships a city pool with plausible coordinates", () => {
    const cities = loadCities();
    expect(cities.length).toBeGreaterThan(300);

    for (const c of cities) {
      expect(c.name).toBeTruthy();
      expect(c.cca3).toMatch(/^[A-Z]{3}$/);
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lng)).toBeLessThanOrEqual(180);
      expect(["easy", "medium", "hard"]).toContain(c.difficulty);
    }
  });

  it("covers all three tiers for both countries and cities", () => {
    for (const pool of [loadCountries(), loadCities()]) {
      const tiers = new Set(pool.map((x) => x.difficulty));
      expect(tiers).toEqual(new Set(["easy", "medium", "hard"]));
    }
  });

  it("only offers countries that are actually on the map for 'localise le pays'", () => {
    const locatable = loadLocatableCountries();
    expect(locatable.length).toBeGreaterThan(100);
    expect(locatable.every((c) => c.locateDifficulty !== null)).toBe(true);

    // Every locatable country must resolve to itself when tapped at its centre.
    const misses = locatable.filter((c) => countryAt(c.lat, c.lng)?.cca3 !== c.cca3);
    // A handful of countries have a centroid in the sea (archipelagos); allow a
    // small margin but not a silently broken dataset.
    expect(misses.length / locatable.length).toBeLessThan(0.1);
  });
});

describe("countryAt", () => {
  it("resolves well-known inland points", () => {
    expect(countryAt(48.85, 2.35)?.cca3).toBe("FRA"); // Paris
    expect(countryAt(35.68, 139.69)?.cca3).toBe("JPN"); // Tokyo
    expect(countryAt(-15.79, -47.88)?.cca3).toBe("BRA"); // Brasília
    expect(countryAt(-25.75, 28.19)?.cca3).toBe("ZAF"); // Pretoria
  });

  it("returns null over open ocean", () => {
    expect(countryAt(0, -140)).toBeNull(); // middle of the Pacific
    expect(countryAt(-40, -20)).toBeNull(); // South Atlantic
  });

  it("prefers the enclave over the country surrounding it", () => {
    // Lesotho sits entirely inside South Africa; the smallest shape must win.
    expect(countryAt(-29.31, 27.48)?.cca3).toBe("LSO");
  });

  it("forgives a tap just off the coast, within the shared tolerance", () => {
    const paris = countryAt(48.85, 2.35)!;
    expect(paris.cca3).toBe("FRA");

    // Just outside a border but inside TAP_TOLERANCE_DEG still resolves.
    const nearMiss = countryAt(48.85, 2.35 + TAP_TOLERANCE_DEG / 2);
    expect(nearMiss).not.toBeNull();
  });
});

describe("haversineKm", () => {
  it("is zero for a point against itself", () => {
    expect(haversineKm(48.85, 2.35, 48.85, 2.35)).toBe(0);
  });

  it("matches known distances within 1%", () => {
    // Paris ↔ New York ≈ 5837 km
    expect(haversineKm(48.85, 2.35, 40.71, -74.01)).toBeCloseTo(5837, -2);
    // Paris ↔ Tokyo ≈ 9713 km
    expect(haversineKm(48.85, 2.35, 35.68, 139.69)).toBeCloseTo(9713, -2);
  });

  it("is symmetric", () => {
    const a = haversineKm(10, 20, -30, 140);
    const b = haversineKm(-30, 140, 10, 20);
    expect(a).toBeCloseTo(b, 6);
  });

  it("never exceeds half the earth's circumference", () => {
    expect(haversineKm(90, 0, -90, 0)).toBeLessThanOrEqual(20_040);
  });
});

describe("difficultyRamp", () => {
  it("stays gentle for very short segments", () => {
    expect(difficultyRamp(1)).toEqual(["easy"]);
    expect(difficultyRamp(2)).toEqual(["easy", "medium"]);
    expect(difficultyRamp(3)).toEqual(["easy", "medium", "hard"]);
  });

  it("ramps easy → hard over longer segments", () => {
    const ramp = difficultyRamp(10);
    expect(ramp).toHaveLength(10);
    expect(ramp[0]).toBe("easy");
    expect(ramp.at(-1)).toBe("hard");
    // Never goes backwards.
    const rank = { easy: 0, medium: 1, hard: 2 } as const;
    for (let i = 1; i < ramp.length; i++) {
      expect(rank[ramp[i]]).toBeGreaterThanOrEqual(rank[ramp[i - 1]]);
    }
  });
});

describe("pickByDifficultyRamp", () => {
  const item = (id: string, tier: "easy" | "medium" | "hard") => ({ id, tier });
  const pool = [
    ...Array.from({ length: 5 }, (_, i) => item(`e${i}`, "easy")),
    ...Array.from({ length: 5 }, (_, i) => item(`m${i}`, "medium")),
    ...Array.from({ length: 5 }, (_, i) => item(`h${i}`, "hard")),
  ];

  it("follows the ramp and never repeats", () => {
    const picked = pickByDifficultyRamp(pool, 6, (x) => x.tier, (x) => x.id);
    expect(picked).toHaveLength(6);
    expect(new Set(picked.map((p) => p.id)).size).toBe(6);
    expect(picked[0].tier).toBe("easy");
    expect(picked.at(-1)!.tier).toBe("hard");
  });

  it("borrows from a neighbouring tier rather than coming up short", () => {
    const easyOnly = Array.from({ length: 4 }, (_, i) => item(`e${i}`, "easy"));
    const picked = pickByDifficultyRamp(easyOnly, 4, (x) => x.tier, (x) => x.id);
    expect(picked).toHaveLength(4);
  });

  it("stops instead of repeating when the pool is exhausted", () => {
    const tiny = [item("a", "easy"), item("b", "medium")];
    const picked = pickByDifficultyRamp(tiny, 5, (x) => x.tier, (x) => x.id);
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((p) => p.id)).size).toBe(2);
  });

  it("skips items with no tier", () => {
    const mixed = [item("a", "easy"), { id: "x", tier: null }, item("b", "medium")];
    const picked = pickByDifficultyRamp(
      mixed,
      3,
      (x) => x.tier as "easy" | "medium" | "hard" | null,
      (x) => x.id
    );
    expect(picked.map((p) => p.id)).not.toContain("x");
  });
});

describe("cityProximityRatio", () => {
  it("is a bullseye inside the perfect radius", () => {
    expect(cityProximityRatio(0, false)).toBe(1);
    expect(cityProximityRatio(CITY_PERFECT_KM, false)).toBe(1);
  });

  it("decays as the pin gets further away", () => {
    const near = cityProximityRatio(200, false);
    const mid = cityProximityRatio(600, false);
    const far = cityProximityRatio(1000, false);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it("dies out past the decay distance", () => {
    expect(cityProximityRatio(1300, false)).toBe(0);
    expect(cityProximityRatio(20_000, false)).toBe(0);
  });

  it("still rewards landing in the right country", () => {
    expect(cityProximityRatio(20_000, true)).toBe(CITY_COUNTRY_FLOOR);
    // …but never *reduces* a good pin to the floor.
    expect(cityProximityRatio(0, true)).toBe(1);
  });

  it("always returns a ratio between 0 and 1", () => {
    for (const d of [0, 10, 75, 76, 500, 1275, 5000]) {
      for (const same of [true, false]) {
        const r = cityProximityRatio(d, same);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("answer matching", () => {
  const countries = loadCountries();
  const byCode = (cca3: string) => countries.find((c) => c.cca3 === cca3)!;
  // The engine builds the accepted list this way (see loadQuestionsForMode).
  const namesOf = (cca3: string) => {
    const c = byCode(cca3);
    return [c.nameFr, c.nameEn, ...c.aliases];
  };
  const capitalsOf = (cca3: string) => {
    const c = byCode(cca3);
    return [c.capital, ...c.capitalAliases];
  };

  it("accepts the exact name", () => {
    expect(matchesCountryName("France", "FRA", namesOf("FRA"))).toBe(true);
  });

  it("ignores case, accents, hyphens and surrounding whitespace", () => {
    expect(matchesCountryName("  france  ", "FRA", namesOf("FRA"))).toBe(true);
    expect(matchesCountryName("FRANCE", "FRA", namesOf("FRA"))).toBe(true);
    expect(matchesCountryName("bresil", "BRA", namesOf("BRA"))).toBe(true);
    expect(matchesCountryName("BRÉSIL", "BRA", namesOf("BRA"))).toBe(true);
  });

  it("accepts the English name too", () => {
    expect(matchesCountryName("Germany", "DEU", namesOf("DEU"))).toBe(true);
    expect(matchesCountryName("Spain", "ESP", namesOf("ESP"))).toBe(true);
  });

  it("forgives a genuine typo on a long enough name", () => {
    expect(matchesCountryName("Allemagen", "DEU", namesOf("DEU"))).toBe(true);
    expect(matchesCountryName("Portgual", "PRT", namesOf("PRT"))).toBe(true);
  });

  it("never 'fixes' an answer into a different country", () => {
    // One edit apart, but both are real countries.
    expect(matchesCountryName("Irak", "IRN", namesOf("IRN"))).toBe(false);
    expect(matchesCountryName("Iran", "IRQ", namesOf("IRQ"))).toBe(false);
    expect(matchesCountryName("Gambie", "ZMB", namesOf("ZMB"))).toBe(false);
    expect(matchesCountryName("Zambie", "GMB", namesOf("GMB"))).toBe(false);
  });

  it("rejects an unrelated answer or an empty one", () => {
    expect(matchesCountryName("Allemagne", "FRA", namesOf("FRA"))).toBe(false);
    expect(matchesCountryName("", "FRA", namesOf("FRA"))).toBe(false);
    expect(matchesCountryName("a", "FRA", namesOf("FRA"))).toBe(false);
  });

  it("accepts capitals the same way", () => {
    expect(matchesCapitalName("Paris", "FRA", capitalsOf("FRA"))).toBe(true);
    expect(matchesCapitalName("paris", "FRA", capitalsOf("FRA"))).toBe(true);
    expect(matchesCapitalName("Berlin", "FRA", capitalsOf("FRA"))).toBe(false);
  });

  it("lets every country be answered by its own name and capital", () => {
    // Dataset-wide guarantee: nobody should be unable to spell their answer.
    const failures = countries.filter(
      (c) =>
        !matchesCountryName(c.nameFr, c.cca3, namesOf(c.cca3)) ||
        !matchesCapitalName(c.capital, c.cca3, capitalsOf(c.cca3))
    );
    expect(failures.map((f) => f.cca3)).toEqual([]);
  });

  it("does not let one country's name answer for another", () => {
    // Every country name, checked against every *other* country.
    const collisions: string[] = [];
    for (const c of countries) {
      for (const other of countries) {
        if (other.cca3 === c.cca3) continue;
        if (matchesCountryName(c.nameFr, other.cca3, namesOf(other.cca3))) {
          collisions.push(`${c.nameFr} accepted for ${other.cca3}`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });
});
