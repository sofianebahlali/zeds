/**
 * Generate Pokémon Stats data for the pokestats game mode.
 * Fetches all Gen 1-5 Pokémon (649) from PokéAPI GraphQL endpoint.
 *
 * Usage: npx tsx scripts/generate-pokemon-data.ts
 */

const GRAPHQL_URL = "https://beta.pokeapi.co/graphql/v1beta";
const MAX_ID = 649;
const OUTPUT_PATH = "./data/questions/pokemon-stats.json";

interface PokemonEntry {
  id: number;
  nameEn: string;
  nameFr: string;
  aliases: string[];
  generation: number;
  types: string[];
  typesFr: string[];
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
  abilities: string[];
  abilitiesFr: string[];
}

const QUERY = `
{
  pokemon_v2_pokemon(where: {id: {_lte: ${MAX_ID}}}, order_by: {id: asc}) {
    id
    name
    pokemon_v2_pokemonstats(order_by: {stat_id: asc}) {
      base_stat
      pokemon_v2_stat {
        name
      }
    }
    pokemon_v2_pokemontypes(order_by: {slot: asc}) {
      pokemon_v2_type {
        name
        pokemon_v2_typenames(where: {pokemon_v2_language: {name: {_eq: "fr"}}}) {
          name
        }
      }
    }
    pokemon_v2_pokemonabilities(where: {is_hidden: {_eq: false}}) {
      pokemon_v2_ability {
        name
        pokemon_v2_abilitynames(where: {pokemon_v2_language: {name: {_eq: "fr"}}}) {
          name
        }
      }
    }
    pokemon_v2_pokemonspecy {
      generation_id
      pokemon_v2_pokemonspeciesnames(where: {pokemon_v2_language: {name: {_in: ["fr", "en"]}}}) {
        name
        pokemon_v2_language {
          name
        }
      }
    }
  }
}
`;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function main() {
  console.log(`Fetching all ${MAX_ID} Pokémon from PokéAPI GraphQL...`);

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
    throw new Error("GraphQL returned errors");
  }

  const rawPokemon = json.data.pokemon_v2_pokemon;
  console.log(`Received ${rawPokemon.length} Pokémon`);

  const result: PokemonEntry[] = [];

  for (const p of rawPokemon) {
    const species = p.pokemon_v2_pokemonspecy;
    const speciesNames = species?.pokemon_v2_pokemonspeciesnames || [];

    const nameFr = speciesNames.find((n: any) => n.pokemon_v2_language.name === "fr")?.name || capitalize(p.name);
    const nameEn = speciesNames.find((n: any) => n.pokemon_v2_language.name === "en")?.name || capitalize(p.name);

    // Stats: order is hp, attack, defense, special-attack, special-defense, speed
    const statsRaw = p.pokemon_v2_pokemonstats;
    const statMap: Record<string, number> = {};
    for (const s of statsRaw) {
      statMap[s.pokemon_v2_stat.name] = s.base_stat;
    }

    const stats = {
      hp: statMap["hp"] || 0,
      atk: statMap["attack"] || 0,
      def: statMap["defense"] || 0,
      spa: statMap["special-attack"] || 0,
      spd: statMap["special-defense"] || 0,
      spe: statMap["speed"] || 0,
    };

    // Types
    const types: string[] = [];
    const typesFr: string[] = [];
    for (const t of p.pokemon_v2_pokemontypes) {
      const typeData = t.pokemon_v2_type;
      types.push(capitalize(typeData.name));
      const frName = typeData.pokemon_v2_typenames?.[0]?.name;
      typesFr.push(frName || capitalize(typeData.name));
    }

    // Abilities (non-hidden)
    const abilities: string[] = [];
    const abilitiesFr: string[] = [];
    for (const a of p.pokemon_v2_pokemonabilities) {
      const abilityData = a.pokemon_v2_ability;
      abilities.push(capitalize(abilityData.name.replace(/-/g, " ")));
      const frName = abilityData.pokemon_v2_abilitynames?.[0]?.name;
      abilitiesFr.push(frName || capitalize(abilityData.name.replace(/-/g, " ")));
    }

    // Build aliases: include both FR and EN names (they'll be compared normalized)
    // Also add name without special characters
    const aliases: string[] = [];

    result.push({
      id: p.id,
      nameEn,
      nameFr,
      aliases,
      generation: species?.generation_id || 1,
      types,
      typesFr,
      stats,
      abilities,
      abilitiesFr,
    });
  }

  // Write output
  const fs = await import("fs");
  const path = await import("path");
  const outputPath = path.resolve(OUTPUT_PATH);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`Written ${result.length} Pokémon to ${outputPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
