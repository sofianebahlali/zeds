/**
 * Build the country dataset used by the geography modes
 * (Devine le drapeau / Devine la capitale / Localise le pays / Localise la ville).
 *
 *   npx tsx scripts/build-countries.ts
 *
 * Sources (downloaded once into .cache/):
 *  - Natural Earth 50m admin-0 countries  → names FR, ISO codes, population, area, geometry
 *  - Natural Earth 50m populated places   → capitals + cities (FR names) + coordinates
 *  - flagcdn.com                          → flag assets, stored locally in public/images/flags
 *
 * Outputs:
 *  - data/questions/countries.json        → the question pool (server-side)
 *  - data/questions/cities.json           → the "Localise la ville" pool (server-side)
 *  - public/geo/world-countries.json      → simplified world geometry (client map + server hit-test)
 *  - public/images/flags/<cca2>.svg|png   → local flag assets
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache");
const FLAGS_DIR = path.join(ROOT, "public", "images", "flags");
const GEO_OUT = path.join(ROOT, "public", "geo", "world-countries.json");
const DATA_OUT = path.join(ROOT, "data", "questions", "countries.json");
const CITIES_OUT = path.join(ROOT, "data", "questions", "cities.json");

const NE_BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
const NE_COUNTRIES = `${NE_BASE}/ne_50m_admin_0_countries.geojson`;
const NE_PLACES = `${NE_BASE}/ne_50m_populated_places.geojson`;

// Geometry simplification. Douglas-Peucker tolerance in degrees; rings smaller than
// TINY_RING_AREA keep every point (else micro-states collapse into nothing).
const SIMPLIFY_TOLERANCE = 0.05;
const MIN_ISLAND_AREA = 0.05; // deg² — secondary islands below this are dropped
const TINY_RING_AREA = 0.5; // deg² — below this a ring is kept verbatim

// ==========================================
// CURATED DATA
// ==========================================

/** Countries a French player is expected to name without hesitating. */
const EASY = `FRA DEU ESP ITA GBR PRT BEL NLD CHE AUT IRL POL GRC SWE NOR DNK FIN RUS UKR TUR
  MAR DZA TUN EGY ZAF NGA SEN CIV CMR MLI COD
  USA CAN MEX BRA ARG COL CHL PER CUB JAM
  CHN JPN IND KOR THA VNM IDN ISR SAU ARE
  AUS NZL`.split(/\s+/);

/** Known, but not automatic. */
const MEDIUM = `CZE SVK HUN ROU BGR HRV SRB SVN BIH ALB MKD MNE LTU LVA EST BLR MDA ISL LUX MLT CYP
  MCO AND SMR VAT LIE XKX
  LBY ETH KEN TZA GHA BFA NER TCD SDN SSD SOM AGO COG GAB ZWE ZMB MOZ NAM BWA RWA UGA MRT GIN BEN TGO MDG MUS
  PAK BGD LKA NPL AFG IRN IRQ SYR LBN JOR QAT KWT OMN YEM PRK MNG KAZ UZB MYS SGP PHL MMR KHM LAO TWN GEO ARM AZE
  VEN ECU BOL PRY URY GTM CRI PAN HTI DOM HND NIC SLV TTO BHS
  PNG FJI`.split(/\s+/);

/**
 * Countries whose Natural Earth capital is outdated, ambiguous or multi-valued.
 * `capital` is the answer shown at reveal, `also` are extra accepted answers.
 */
const CAPITAL_OVERRIDES: Record<string, { capital: string; also?: string[] }> = {
  KAZ: { capital: "Astana", also: ["Noursoultan", "Nur-Sultan"] },
  BDI: { capital: "Gitega", also: ["Bujumbura"] },
  ZAF: { capital: "Pretoria", also: ["Le Cap", "Cape Town", "Bloemfontein"] },
  BOL: { capital: "Sucre", also: ["La Paz"] },
  CIV: { capital: "Yamoussoukro", also: ["Abidjan"] },
  MMR: { capital: "Naypyidaw", also: ["Nay Pyi Taw", "Rangoun", "Yangon"] },
  NLD: { capital: "Amsterdam", also: ["La Haye"] },
  ISR: { capital: "Jérusalem", also: ["Tel Aviv"] },
  BEN: { capital: "Porto-Novo", also: ["Cotonou"] },
  TZA: { capital: "Dodoma", also: ["Dar es Salaam"] },
  LKA: { capital: "Colombo", also: ["Sri Jayawardenepura Kotte", "Kotte"] },
  SWZ: { capital: "Mbabane", also: ["Lobamba"] },
  PSE: { capital: "Ramallah", also: ["Jérusalem-Est"] },
  MYS: { capital: "Kuala Lumpur", also: ["Putrajaya"] },
  TWN: { capital: "Taipei", also: ["Taïpei", "Taipeh"] },
  CHL: { capital: "Santiago", also: ["Santiago du Chili"] },
  COD: { capital: "Kinshasa" },
  COG: { capital: "Brazzaville" },
  PLW: { capital: "Ngerulmud", also: ["Melekeok"] },
  NRU: { capital: "Yaren", also: ["Aucune", "Pas de capitale"] },
  CHE: { capital: "Berne", also: ["Bern"] },
  IND: { capital: "New Delhi", also: ["Delhi", "Nouvelle-Delhi"] },
  BRA: { capital: "Brasilia", also: ["Brasília"] },
  USA: { capital: "Washington", also: ["Washington D.C.", "Washington DC"] },
  KOR: { capital: "Séoul" },
  PRK: { capital: "Pyongyang" },
  XKX: { capital: "Pristina", also: ["Prishtina", "Priština"] },
  VAT: { capital: "Cité du Vatican", also: ["Vatican", "Rome"] },
  MCO: { capital: "Monaco", also: ["Monaco-Ville"] },
  SGP: { capital: "Singapour" },
};

/** Natural Earth's French name is the formal one — use the everyday one instead. */
const NAME_OVERRIDES: Record<string, string> = {
  CHN: "Chine",
};

/** Extra accepted spellings / common names for country names. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  USA: ["Etats-Unis", "États-Unis", "USA", "US", "Etats Unis d'Amérique", "Amérique"],
  GBR: ["Royaume-Uni", "UK", "Angleterre", "Grande-Bretagne", "Great Britain", "United Kingdom"],
  NLD: ["Pays-Bas", "Hollande", "Netherlands"],
  DEU: ["Allemagne", "Germany", "Deutschland"],
  CHE: ["Suisse", "Switzerland", "Helvétie"],
  MMR: ["Birmanie", "Myanmar", "Burma"],
  CZE: ["Tchéquie", "République tchèque", "Czech Republic"],
  COD: ["RDC", "République démocratique du Congo", "Congo-Kinshasa", "Zaïre", "Congo RDC"],
  COG: ["Congo", "Congo-Brazzaville", "République du Congo"],
  KOR: ["Corée du Sud", "South Korea", "Corée"],
  PRK: ["Corée du Nord", "North Korea"],
  ARE: ["Émirats arabes unis", "Emirats", "EAU", "Dubaï"],
  CIV: ["Côte d'Ivoire", "Ivory Coast"],
  CPV: ["Cap-Vert", "Cabo Verde"],
  SWZ: ["Eswatini", "Swaziland"],
  MKD: ["Macédoine du Nord", "Macédoine"],
  TLS: ["Timor oriental", "Timor-Leste"],
  MDA: ["Moldavie", "Moldova"],
  BLR: ["Biélorussie", "Bélarus"],
  LKA: ["Sri Lanka", "Ceylan"],
  ZWE: ["Zimbabwe", "Rhodésie"],
  TUR: ["Turquie", "Türkiye"],
  GRC: ["Grèce", "Hellade"],
  VAT: ["Vatican", "Saint-Siège", "Cité du Vatican"],
  XKX: ["Kosovo"],
  TWN: ["Taïwan", "Taiwan", "Formose"],
  PSE: ["Palestine", "Territoires palestiniens"],
  CAF: ["Centrafrique", "République centrafricaine"],
  DOM: ["République dominicaine"],
  ZAF: ["Afrique du Sud", "South Africa"],
  IRN: ["Iran", "Perse"],
  NZL: ["Nouvelle-Zélande", "New Zealand"],
  PNG: ["Papouasie-Nouvelle-Guinée", "Papouasie"],
  BIH: ["Bosnie-Herzégovine", "Bosnie"],
  GNQ: ["Guinée équatoriale"],
  GNB: ["Guinée-Bissau"],
  SLE: ["Sierra Leone"],
  BFA: ["Burkina Faso", "Burkina", "Haute-Volta"],
  LAO: ["Laos"],
  KHM: ["Cambodge", "Kampuchéa"],
  VNM: ["Vietnam", "Viêt Nam"],
  STP: ["Sao Tomé-et-Principe", "Sao Tomé"],
  KNA: ["Saint-Christophe-et-Niévès", "Saint-Kitts-et-Nevis"],
  VCT: ["Saint-Vincent-et-les-Grenadines", "Saint-Vincent"],
  LCA: ["Sainte-Lucie"],
  ATG: ["Antigua-et-Barbuda", "Antigua"],
  TTO: ["Trinité-et-Tobago", "Trinidad et Tobago"],
  SLB: ["Îles Salomon", "Salomon"],
  MHL: ["Îles Marshall", "Marshall"],
  FSM: ["Micronésie", "États fédérés de Micronésie"],
  BRN: ["Brunei", "Brunéi"],
  MYS: ["Malaisie", "Malaysia"],
  SGP: ["Singapour", "Singapore"],
  MDV: ["Maldives"],
  SYC: ["Seychelles"],
  COM: ["Comores"],
  CUW: ["Curaçao"],
};

/**
 * Entries Natural Earth does not flag as UN members (or whose "sovereign" field points
 * elsewhere) but that belong in a flag quiz all the same.
 */
const FORCE_INCLUDE = new Set(["TWN", "XKX", "NOR", "PSE"]);

/** Natural Earth entries that are not countries for our purposes. */
const EXCLUDED = new Set(["ATA", "ATF", "ESH", "CYN", "SOL"]);

/** ADM0_A3 → ISO 3166-1 alpha-3 for the few entries where Natural Earth disagrees. */
const CCA3_FIXES: Record<string, string> = { KOS: "XKX", SDS: "SSD", PSX: "PSE" };

/** Shapes folded into their neighbour on the map (Morocco administers Western Sahara). */
const GEO_MERGES: Record<string, string> = { ESH: "MAR" };

/** Left off the map entirely. */
const NO_GEOMETRY = new Set(["ATA", "ATF"]);

// ── "Localise la ville" ────────────────────────────────────
// Natural Earth ships ~1250 populated places; only a fraction of them are worth asking.

/** Below this a place is only kept if it is a national capital. */
const MIN_CITY_POP = 250_000;

/** Cities in a dependency answer to the state the map draws them in. */
const CITY_ADM0_FALLBACK: Record<string, string> = {
  HKG: "CHN", MAC: "CHN", PRI: "USA", GUM: "USA", GRL: "DNK",
  NCL: "FRA", PYF: "FRA", REU: "FRA", GUF: "FRA", MTQ: "FRA", GLP: "FRA",
  ABW: "NLD", CUW: "NLD",
};

/**
 * Cities a French player places without thinking. Curated rather than derived:
 * population is a poor proxy for fame (Solapur is bigger than Venice).
 * Names must match Natural Earth's NAME_FR — the build warns on any that don't.
 */
const CITY_EASY = [
  // Europe
  "Paris", "Londres", "Madrid", "Barcelone", "Rome", "Milan", "Venise", "Naples", "Berlin",
  "Munich", "Hambourg", "Francfort", "Amsterdam", "Bruxelles", "Lisbonne", "Vienne", "Prague",
  "Budapest", "Varsovie", "Athènes", "Stockholm", "Oslo", "Copenhague", "Helsinki", "Dublin",
  "Zurich", "Genève", "Moscou", "Saint-Pétersbourg", "Istanbul", "Kiev", "Marseille", "Lyon",
  "Bordeaux", "Édimbourg", "Séville", "Bucarest", "Belgrade", "Sofia", "Reykjavik",
  // Amériques
  "New York", "Los Angeles", "San Francisco", "Las Vegas", "Chicago", "Miami", "Washington",
  "Boston", "Seattle", "Houston", "Toronto", "Montréal", "Vancouver", "Mexico", "La Havane",
  "Bogota", "Lima", "Santiago", "Buenos Aires", "Rio de Janeiro", "São Paulo", "Brasilia",
  "Caracas",
  // Afrique
  "Le Caire", "Casablanca", "Marrakech", "Alger", "Tunis", "Dakar", "Abidjan", "Lagos", "Nairobi",
  "Le Cap", "Johannesbourg", "Addis-Abeba", "Kinshasa", "Accra", "Rabat",
  // Asie & Océanie
  "Tokyo", "Osaka", "Kyoto", "Pékin", "Shanghai", "Hong Kong", "Séoul", "Taipei", "Bangkok",
  "Singapour", "Kuala Lumpur", "Jakarta", "Manille", "Hanoï", "Bombay", "New Delhi", "Calcutta",
  "Dubaï", "Doha", "Riyad", "Téhéran", "Bagdad", "Jérusalem", "Tel Aviv", "Katmandou", "Sydney",
  "Melbourne", "Auckland",
];

const CONTINENT_FR: Record<string, string> = {
  Europe: "Europe",
  Asia: "Asie",
  Africa: "Afrique",
  "North America": "Amérique du Nord",
  "South America": "Amérique du Sud",
  Oceania: "Océanie",
  "Seven seas (open ocean)": "Océanie",
  Antarctica: "Antarctique",
};

// ==========================================
// TYPES
// ==========================================

type Ring = [number, number][];
type Poly = Ring[];

interface NEFeature {
  properties: Record<string, string | number | null>;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

interface CountryRecord {
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
  difficulty: "easy" | "medium" | "hard";
  locateDifficulty: "easy" | "medium" | "hard" | null;
}

interface CityRecord {
  name: string;
  cca3: string;
  countryName: string;
  flagFile: string;
  continent: string;
  lat: number;
  lng: number;
  population: number;
  isCapital: boolean;
  difficulty: "easy" | "medium" | "hard";
}

// ==========================================
// HELPERS
// ==========================================

async function download(url: string, dest: string): Promise<void> {
  if (fs.existsSync(dest)) return;
  process.stdout.write(`  ↓ ${path.basename(dest)} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  console.log(`${Math.round(buf.length / 1024)} KB`);
}

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a) / 2;
}

/** Douglas–Peucker, iterative (recursion blows up on 10k-point rings). */
function simplifyRing(points: Ring, tolerance: number): Ring {
  if (points.length < 4 || tolerance <= 0) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    if (e <= s + 1) continue;
    const [x1, y1] = points[s];
    const [x2, y2] = points[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const den = Math.hypot(dx, dy);
    let maxDist = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const [x, y] = points[i];
      const dist = den === 0
        ? Math.hypot(x - x1, y - y1)
        : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / den;
      if (dist > maxDist) {
        maxDist = dist;
        idx = i;
      }
    }
    if (maxDist > tolerance) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function roundRing(ring: Ring, decimals: number): Ring {
  const f = Math.pow(10, decimals);
  const out: Ring = [];
  for (const [x, y] of ring) {
    const p: [number, number] = [Math.round(x * f) / f, Math.round(y * f) / f];
    if (out.length === 0 || out[out.length - 1][0] !== p[0] || out[out.length - 1][1] !== p[1]) {
      out.push(p);
    }
  }
  return out;
}

function processRing(ring: Ring): Ring | null {
  const area = ringArea(ring);
  // Micro-states survive only if we neither simplify nor coarsely round them.
  const tolerance = area < TINY_RING_AREA ? 0 : SIMPLIFY_TOLERANCE;
  const decimals = area < TINY_RING_AREA ? 3 : 2;
  let out = roundRing(simplifyRing(ring, tolerance), decimals);
  if (out.length < 4) return null;
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out = [...out, first];
  return out;
}

function simplifyGeometry(geom: NEFeature["geometry"]): Poly[] {
  const polys: Poly[] = geom.type === "Polygon"
    ? [geom.coordinates as unknown as Poly]
    : (geom.coordinates as unknown as Poly[]);

  const sorted = [...polys].sort((a, b) => ringArea(b[0]) - ringArea(a[0]));
  const out: Poly[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const poly = sorted[i];
    // Always keep the mainland, drop negligible islands.
    if (i > 0 && ringArea(poly[0]) < MIN_ISLAND_AREA) continue;
    const rings: Ring[] = [];
    for (let j = 0; j < poly.length; j++) {
      const r = processRing(poly[j]);
      if (!r) {
        if (j === 0) {
          rings.length = 0;
          break;
        }
        continue;
      }
      rings.push(r);
    }
    if (rings.length) out.push(rings);
  }
  return out;
}

function toTitleCase(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Lowercase, accent-free — used to tell a real exonym (Bénarès/Varanasi) from a diacritic (Āgrā/Agra). */
function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  console.log("→ Downloading Natural Earth data");
  const countriesFile = path.join(CACHE_DIR, "ne_50m_admin_0_countries.geojson");
  const placesFile = path.join(CACHE_DIR, "ne_50m_populated_places.geojson");
  await download(NE_COUNTRIES, countriesFile);
  await download(NE_PLACES, placesFile);

  const neCountries = JSON.parse(fs.readFileSync(countriesFile, "utf-8")) as { features: NEFeature[] };
  const nePlaces = JSON.parse(fs.readFileSync(placesFile, "utf-8")) as {
    features: { properties: Record<string, string | number | null>; geometry: { coordinates: [number, number] } }[];
  };

  // ── Capitals ──────────────────────────────────────────────
  // Natural Earth lists secondary seats of government as "Admin-0 capital alt" and can emit
  // several primaries (South Africa). The first true primary wins, the rest become aliases.
  const rawCapitals = new Map<string, { name: string; primary: boolean; lat: number; lng: number }[]>();
  for (const f of nePlaces.features) {
    const p = f.properties;
    const cls = String(p.FEATURECLA || "");
    if (!cls.startsWith("Admin-0 capital")) continue;
    const adm0 = String(p.ADM0_A3 || "");
    if (!adm0) continue;
    const iso = CCA3_FIXES[adm0] || adm0;
    const name = toTitleCase(String(p.NAME_FR || p.NAME || ""));
    if (!name) continue;
    const list = rawCapitals.get(iso) || [];
    list.push({
      name,
      primary: cls === "Admin-0 capital",
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    });
    rawCapitals.set(iso, list);
  }

  const capitals = new Map<string, { name: string; alt: string[]; lat: number; lng: number }>();
  for (const [iso, list] of rawCapitals) {
    const main = list.find((c) => c.primary) || list[0];
    capitals.set(iso, {
      name: main.name,
      alt: list.filter((c) => c.name !== main.name).map((c) => c.name),
      lat: main.lat,
      lng: main.lng,
    });
  }

  // ── Countries ─────────────────────────────────────────────
  const easySet = new Set(EASY);
  const mediumSet = new Set(MEDIUM);
  const records: CountryRecord[] = [];

  // ── Geometry ──────────────────────────────────────────────
  // Every landmass is drawn, dependencies included: a world map with a hole where
  // Greenland should be looks broken. Only sovereign states end up being *asked*.
  const shapes = new Map<string, Poly[]>();
  const shapeNames = new Map<string, string>();
  for (const f of neCountries.features) {
    const p = f.properties;
    const adm0 = String(p.ADM0_A3 || "");
    if (NO_GEOMETRY.has(adm0)) continue;
    const isoA3 = String(p.ISO_A3_EH || "");
    const rawId = CCA3_FIXES[adm0] || (isoA3 && isoA3 !== "-99" ? isoA3 : adm0);
    const id = GEO_MERGES[rawId] || rawId;
    const geometry = simplifyGeometry(f.geometry);
    if (!geometry.length) continue;
    shapes.set(id, [...(shapes.get(id) || []), ...geometry]);
    if (!shapeNames.has(id)) {
      shapeNames.set(id, NAME_OVERRIDES[id] || toTitleCase(String(p.NAME_FR || p.NAME || "")));
    }
  }

  for (const f of neCountries.features) {
    const p = f.properties;
    const adm0 = String(p.ADM0_A3 || "");
    const isoA3 = String(p.ISO_A3_EH || "");
    const cca3 = CCA3_FIXES[adm0] || (isoA3 && isoA3 !== "-99" ? isoA3 : adm0);
    const unCode = String(p.UN_A3 ?? "-099");
    const isUn = unCode !== "-099" && unCode !== "-99";
    // Dependencies (Jersey, Aruba, Greenland…) carry a UN code but answer to another state.
    const isSovereign = p.SOVEREIGNT === p.ADMIN;
    const wanted = FORCE_INCLUDE.has(cca3) || (isSovereign && isUn);
    if (!wanted || EXCLUDED.has(cca3)) continue;

    let cca2 = String(p.ISO_A2_EH || p.ISO_A2 || "").toLowerCase();
    if (cca2 === "-99" || cca2.length !== 2) {
      const fallback: Record<string, string> = { XKX: "xk", TWN: "tw", PSE: "ps", VAT: "va", FRA: "fr", NOR: "no" };
      cca2 = fallback[cca3] || "";
    }
    if (!cca2) {
      console.warn(`  ! no ISO2 for ${cca3}, skipped`);
      continue;
    }

    const neNameFr = toTitleCase(String(p.NAME_FR || p.NAME || ""));
    const nameFr = NAME_OVERRIDES[cca3] || neNameFr;
    const nameEn = toTitleCase(String(p.NAME_EN || p.NAME || ""));
    const capOverride = CAPITAL_OVERRIDES[cca3];
    const neCapital = capitals.get(cca3);
    const capital = capOverride?.capital || neCapital?.name || "";
    if (!capital) {
      console.warn(`  ! no capital for ${cca3} (${nameFr})`);
    }

    const capitalAliases = Array.from(new Set([
      ...(capOverride?.also || []),
      ...(neCapital && neCapital.name !== capital ? [neCapital.name] : []),
      ...(neCapital?.alt || []),
    ].filter((c) => c && c !== capital)));

    const aliases = Array.from(new Set([
      ...(COUNTRY_ALIASES[cca3] || []),
      neNameFr,
      nameEn,
      toTitleCase(String(p.NAME_LONG || "")),
      toTitleCase(String(p.FORMAL_FR || "")),
      toTitleCase(String(p.BRK_NAME || "")),
    ].filter((a) => a && a !== nameFr)));

    const population = Number(p.POP_EST || 0);
    const difficulty: CountryRecord["difficulty"] = easySet.has(cca3)
      ? "easy"
      : mediumSet.has(cca3)
      ? "medium"
      : "hard";

    const geometry = shapes.get(cca3);
    let locateDifficulty: CountryRecord["locateDifficulty"] = null;
    if (geometry?.length) {
      // Big landmasses stay at their base difficulty; small ones are hard to tap.
      const totalArea = geometry.reduce((sum, poly) => sum + ringArea(poly[0]), 0);
      const rank = { easy: 0, medium: 1, hard: 2 } as const;
      const sizeTier: CountryRecord["difficulty"] = totalArea > 40 ? "easy" : totalArea > 5 ? "medium" : "hard";
      locateDifficulty = rank[sizeTier] > rank[difficulty] ? sizeTier : difficulty;
    }

    records.push({
      cca2,
      cca3,
      nameFr,
      nameEn,
      aliases,
      capital,
      capitalAliases,
      capitalLat: neCapital?.lat ?? Number(p.LABEL_Y || 0),
      capitalLng: neCapital?.lng ?? Number(p.LABEL_X || 0),
      continent: CONTINENT_FR[String(p.CONTINENT || "")] || String(p.CONTINENT || ""),
      population,
      lat: Number(p.LABEL_Y ?? 0),
      lng: Number(p.LABEL_X ?? 0),
      flagFile: `${cca2}.svg`,
      difficulty,
      locateDifficulty,
    });
  }

  records.sort((a, b) => a.nameFr.localeCompare(b.nameFr, "fr"));

  // Sanity check the curated lists
  const known = new Set(records.map((r) => r.cca3));
  for (const code of [...EASY, ...MEDIUM]) {
    if (!known.has(code)) console.warn(`  ! curated code ${code} matches no country`);
  }

  // ── Flags ─────────────────────────────────────────────────
  console.log("→ Downloading flags");
  fs.mkdirSync(FLAGS_DIR, { recursive: true });
  let downloaded = 0;
  for (const rec of records) {
    const svgPath = path.join(FLAGS_DIR, `${rec.cca2}.svg`);
    const pngPath = path.join(FLAGS_DIR, `${rec.cca2}.png`);
    if (fs.existsSync(svgPath)) {
      rec.flagFile = `${rec.cca2}.svg`;
      continue;
    }
    if (fs.existsSync(pngPath)) {
      rec.flagFile = `${rec.cca2}.png`;
      continue;
    }
    try {
      const res = await fetch(`https://flagcdn.com/${rec.cca2}.svg`);
      if (!res.ok) throw new Error(`${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // A handful of flags (coats of arms) are enormous as SVG — ship a PNG instead.
      if (buf.length > 120_000) {
        const png = await fetch(`https://flagcdn.com/w1280/${rec.cca2}.png`);
        if (png.ok) {
          fs.writeFileSync(pngPath, Buffer.from(await png.arrayBuffer()));
          rec.flagFile = `${rec.cca2}.png`;
          downloaded++;
          continue;
        }
      }
      fs.writeFileSync(svgPath, buf);
      rec.flagFile = `${rec.cca2}.svg`;
      downloaded++;
    } catch (err) {
      console.warn(`  ! flag ${rec.cca2} (${rec.nameFr}): ${(err as Error).message}`);
    }
  }
  // Drop flags left over from a previous run with a different country list
  const wanted = new Set(records.map((r) => r.flagFile));
  let removed = 0;
  for (const file of fs.readdirSync(FLAGS_DIR)) {
    if (!wanted.has(file)) {
      fs.unlinkSync(path.join(FLAGS_DIR, file));
      removed++;
    }
  }
  console.log(`  ${downloaded} new flag(s), ${removed} removed, ${records.length} total`);

  // ── Cities ────────────────────────────────────────────────
  // "Localise la ville" scores on distance, so the pool has to stay recognisable:
  // a player must at least have a rough idea of where the place is.
  const byIso = new Map(records.map((r) => [r.cca3, r]));
  const easyCities = new Set(CITY_EASY.map(deaccent));
  const cityByName = new Map<string, CityRecord & { score: number }>();

  for (const f of nePlaces.features) {
    const p = f.properties;
    const adm0 = String(p.ADM0_A3 || "");
    const country = byIso.get(CITY_ADM0_FALLBACK[adm0] || CCA3_FIXES[adm0] || adm0);
    if (!country) continue;

    const name = toTitleCase(String(p.NAME_FR || p.NAME || ""));
    // Natural Earth labels a few Chinese counties rather than their city.
    if (!name || name.startsWith("Xian de")) continue;
    const key = deaccent(name);
    const population = Number(p.POP_MAX || 0);
    const isCapital = Number(p.ADM0CAP) === 1;
    if (population < MIN_CITY_POP && !isCapital && !easyCities.has(key)) continue;

    // Fame, roughly: a world city beats a capital beats a big city, and a French
    // exonym (Pékin, Bénarès) means the place made it into the language.
    const exonym = key !== deaccent(String(p.NAME || "")) ? 1.5 : 0;
    const countryBonus = country.difficulty === "easy" ? 1 : country.difficulty === "medium" ? 0.5 : 0;
    const score =
      (Number(p.WORLDCITY) === 1 ? 4 : 0) +
      (Number(p.MEGACITY) === 1 ? 1 : 0) +
      (isCapital ? 2.5 : 0) +
      Math.max(0, Math.log10(Math.max(population, 1)) - 5) +
      countryBonus +
      exonym;
    const difficulty: CityRecord["difficulty"] = easyCities.has(key)
      ? "easy"
      : score >= 3.2
      ? "medium"
      : "hard";

    // Two cities sharing a name (Valence, Saint-Louis…) make the question unanswerable:
    // only the biggest one survives.
    const previous = cityByName.get(key);
    if (previous && previous.population >= population) continue;
    cityByName.set(key, {
      name,
      cca3: country.cca3,
      countryName: country.nameFr,
      flagFile: country.flagFile,
      continent: country.continent,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      population,
      isCapital,
      difficulty,
      score,
    });
  }

  // The hard tier degrades into places nobody has heard of — keep only its best.
  const MAX_HARD_CITIES = 200;
  const cities: CityRecord[] = [];
  let hardKept = 0;
  for (const city of Array.from(cityByName.values()).sort((a, b) => b.score - a.score)) {
    if (city.difficulty === "hard" && ++hardKept > MAX_HARD_CITIES) continue;
    const { score: _score, ...record } = city;
    cities.push(record);
  }
  cities.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const easyFound = new Set(cities.filter((c) => c.difficulty === "easy").map((c) => deaccent(c.name)));
  for (const name of CITY_EASY) {
    if (!easyFound.has(deaccent(name))) console.warn(`  ! curated city "${name}" matches no place`);
  }

  // ── Write ─────────────────────────────────────────────────
  fs.mkdirSync(path.dirname(GEO_OUT), { recursive: true });
  const byCca3 = new Map(records.map((r) => [r.cca3, r]));
  const geoFeatures = Array.from(shapes.entries()).map(([id, coordinates]) => ({
    type: "Feature" as const,
    id,
    properties: { name: byCca3.get(id)?.nameFr || shapeNames.get(id) || id },
    geometry: { type: "MultiPolygon" as const, coordinates },
  }));
  const geo = { type: "FeatureCollection" as const, features: geoFeatures };
  fs.writeFileSync(GEO_OUT, JSON.stringify(geo));
  fs.writeFileSync(DATA_OUT, JSON.stringify(records, null, 0));
  fs.writeFileSync(CITIES_OUT, JSON.stringify(cities, null, 0));

  const byDiff = (d: string) => records.filter((r) => r.difficulty === d).length;
  const byLocate = (d: string) => records.filter((r) => r.locateDifficulty === d).length;
  const byCity = (d: string) => cities.filter((c) => c.difficulty === d).length;
  console.log(`→ ${DATA_OUT} — ${records.length} countries (easy ${byDiff("easy")}, medium ${byDiff("medium")}, hard ${byDiff("hard")})`);
  console.log(`→ ${GEO_OUT} — ${geoFeatures.length} shapes, ${Math.round(fs.statSync(GEO_OUT).size / 1024)} KB`);
  console.log(`  locate pool: easy ${byLocate("easy")}, medium ${byLocate("medium")}, hard ${byLocate("hard")}`);
  console.log(`→ ${CITIES_OUT} — ${cities.length} cities (easy ${byCity("easy")}, medium ${byCity("medium")}, hard ${byCity("hard")})`);
  const missingCapital = records.filter((r) => !r.capital).map((r) => r.nameFr);
  if (missingCapital.length) console.log(`  ! missing capitals: ${missingCapital.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
