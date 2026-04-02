/**
 * Fetch all Pokémon moves from PokeAPI (generations 1-5)
 * Outputs: data/questions/pokemon-attacks.json
 */

const GENERATIONS = [1, 2, 3, 4, 5];
const API_BASE = "https://pokeapi.co/api/v2";

// Map PokeAPI type names to French
const TYPE_FR = {
  normal: "Normal",
  fire: "Feu",
  water: "Eau",
  electric: "Électrik",
  grass: "Plante",
  ice: "Glace",
  fighting: "Combat",
  poison: "Poison",
  ground: "Sol",
  flying: "Vol",
  psychic: "Psy",
  bug: "Insecte",
  rock: "Roche",
  ghost: "Spectre",
  dragon: "Dragon",
  dark: "Ténèbres",
  steel: "Acier",
  fairy: "Fée",
};

const CATEGORY_FR = {
  physical: "Physique",
  special: "Spéciale",
  status: "Statut",
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchGenerationMoves(genId) {
  const gen = await fetchJSON(`${API_BASE}/generation/${genId}`);
  return gen.moves.map((m) => m.url);
}

async function fetchMove(url) {
  const move = await fetchJSON(url);

  const nameFr = move.names.find((n) => n.language.name === "fr")?.name || null;
  const nameEn = move.names.find((n) => n.language.name === "en")?.name || move.name;

  if (!nameFr) return null; // Skip moves without French name

  const typeEn = move.type?.name || "normal";
  const typeFr = TYPE_FR[typeEn] || typeEn;
  const categoryEn = move.damage_class?.name || "status";
  const categoryFr = CATEGORY_FR[categoryEn] || categoryEn;

  return {
    id: move.id,
    nameFr,
    nameEn,
    type: typeFr,
    typeEn,
    category: categoryFr,
    categoryEn,
    power: move.power, // null for status moves
    pp: move.pp,
    generation: parseInt(move.generation.url.split("/").filter(Boolean).pop()),
  };
}

async function main() {
  console.log("Fetching move URLs for generations 1-5...");

  // Collect all move URLs from gen 1-5
  const allMoveUrls = new Set();
  for (const genId of GENERATIONS) {
    const urls = await fetchGenerationMoves(genId);
    urls.forEach((u) => allMoveUrls.add(u));
    console.log(`  Gen ${genId}: ${urls.length} moves`);
  }

  console.log(`Total unique moves: ${allMoveUrls.size}`);
  console.log("Fetching move details (this may take a few minutes)...");

  // Fetch in batches of 20 to avoid rate limiting
  const urls = [...allMoveUrls];
  const results = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((url) => fetchMove(url).catch(() => null)));
    results.push(...batchResults.filter(Boolean));

    if ((i / BATCH_SIZE) % 5 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, urls.length)}/${urls.length}`);
    }
  }

  // Sort by ID
  results.sort((a, b) => a.id - b.id);

  console.log(`\nFetched ${results.length} moves with French names`);
  console.log(`  Physical: ${results.filter((m) => m.categoryEn === "physical").length}`);
  console.log(`  Special: ${results.filter((m) => m.categoryEn === "special").length}`);
  console.log(`  Status: ${results.filter((m) => m.categoryEn === "status").length}`);

  // Write to file
  const fs = await import("fs");
  const path = await import("path");
  const outPath = path.resolve("data/questions/pokemon-attacks.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nWritten to ${outPath}`);
}

main().catch(console.error);
