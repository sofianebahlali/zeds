/**
 * Fetch video game screenshots from Steam API and generate guessgame.json
 *
 * Usage: npx tsx scripts/fetch-guessgame-images.ts
 *
 * This script:
 * 1. Fetches game details from Steam's public API (no API key needed)
 * 2. Downloads one gameplay screenshot per game to public/images/guessgame/
 * 3. Generates data/questions/guessgame.json
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

interface SteamAppDetails {
  success: boolean;
  data: {
    name: string;
    screenshots?: { id: number; path_thumbnail: string; path_full: string }[];
    genres?: { id: string; description: string }[];
    developers?: string[];
    release_date?: { coming_soon: boolean; date: string };
    metacritic?: { score: number };
  };
}

interface GameEntry {
  steamAppId: number;
  acceptedAnswers: string[];
  difficulty: "easy" | "medium" | "hard";
}

// Curated list of well-known games with Steam app IDs
const GAMES: GameEntry[] = [
  { steamAppId: 1091500, acceptedAnswers: ["Cyberpunk 2077", "Cyberpunk"], difficulty: "easy" },
  { steamAppId: 1174180, acceptedAnswers: ["Red Dead Redemption 2", "RDR2", "Red Dead 2"], difficulty: "easy" },
  { steamAppId: 292030, acceptedAnswers: ["The Witcher 3", "Witcher 3", "The Witcher 3: Wild Hunt"], difficulty: "easy" },
  { steamAppId: 1245620, acceptedAnswers: ["Elden Ring"], difficulty: "easy" },
  { steamAppId: 1151640, acceptedAnswers: ["Horizon Zero Dawn", "Horizon"], difficulty: "easy" },
  { steamAppId: 814380, acceptedAnswers: ["Sekiro", "Sekiro: Shadows Die Twice"], difficulty: "medium" },
  { steamAppId: 367520, acceptedAnswers: ["Hollow Knight"], difficulty: "medium" },
  { steamAppId: 413150, acceptedAnswers: ["Stardew Valley"], difficulty: "easy" },
  { steamAppId: 105600, acceptedAnswers: ["Terraria"], difficulty: "easy" },
  { steamAppId: 1086940, acceptedAnswers: ["Baldur's Gate 3", "BG3", "Baldurs Gate 3"], difficulty: "easy" },
  { steamAppId: 730, acceptedAnswers: ["Counter-Strike 2", "CS2", "CS:GO", "Counter-Strike"], difficulty: "easy" },
  { steamAppId: 570, acceptedAnswers: ["Dota 2", "Dota"], difficulty: "easy" },
  { steamAppId: 440, acceptedAnswers: ["Team Fortress 2", "TF2"], difficulty: "medium" },
  { steamAppId: 1172470, acceptedAnswers: ["Apex Legends", "Apex"], difficulty: "easy" },
  { steamAppId: 578080, acceptedAnswers: ["PUBG", "PlayerUnknown's Battlegrounds", "PUBG: Battlegrounds"], difficulty: "easy" },
  { steamAppId: 252490, acceptedAnswers: ["Rust"], difficulty: "medium" },
  { steamAppId: 346110, acceptedAnswers: ["ARK: Survival Evolved", "ARK", "Ark Survival Evolved"], difficulty: "medium" },
  { steamAppId: 892970, acceptedAnswers: ["Valheim"], difficulty: "medium" },
  { steamAppId: 275850, acceptedAnswers: ["No Man's Sky", "No Mans Sky", "NMS"], difficulty: "easy" },
  { steamAppId: 1085660, acceptedAnswers: ["Destiny 2", "Destiny"], difficulty: "medium" },
  { steamAppId: 374320, acceptedAnswers: ["Dark Souls III", "Dark Souls 3", "DS3"], difficulty: "medium" },
  { steamAppId: 236430, acceptedAnswers: ["Dark Souls II", "Dark Souls 2", "DS2"], difficulty: "hard" },
  { steamAppId: 1238810, acceptedAnswers: ["Armored Core VI", "Armored Core 6", "AC6"], difficulty: "hard" },
  { steamAppId: 1794680, acceptedAnswers: ["Vampire Survivors"], difficulty: "medium" },
  { steamAppId: 2358720, acceptedAnswers: ["Black Myth: Wukong", "Black Myth Wukong", "Wukong"], difficulty: "medium" },
  { steamAppId: 620, acceptedAnswers: ["Portal 2", "Portal"], difficulty: "easy" },
  { steamAppId: 4000, acceptedAnswers: ["Garry's Mod", "GMod", "Garrys Mod"], difficulty: "medium" },
  { steamAppId: 218620, acceptedAnswers: ["PAYDAY 2", "Payday 2", "Payday"], difficulty: "medium" },
  { steamAppId: 250900, acceptedAnswers: ["The Binding of Isaac: Rebirth", "Binding of Isaac", "Isaac"], difficulty: "medium" },
  { steamAppId: 251570, acceptedAnswers: ["7 Days to Die", "7DTD", "7 Days"], difficulty: "hard" },
  { steamAppId: 322330, acceptedAnswers: ["Don't Starve Together", "Don't Starve", "Dont Starve"], difficulty: "medium" },
  { steamAppId: 945360, acceptedAnswers: ["Among Us"], difficulty: "easy" },
  { steamAppId: 960090, acceptedAnswers: ["Bloons TD 6", "BTD6", "Bloons"], difficulty: "medium" },
  { steamAppId: 1145360, acceptedAnswers: ["Hades"], difficulty: "medium" },
  { steamAppId: 1966720, acceptedAnswers: ["Lethal Company"], difficulty: "medium" },
  { steamAppId: 1623730, acceptedAnswers: ["Palworld"], difficulty: "easy" },
  { steamAppId: 1222670, acceptedAnswers: ["The Sims 4", "Sims 4", "Les Sims 4"], difficulty: "easy" },
  { steamAppId: 271590, acceptedAnswers: ["Grand Theft Auto V", "GTA V", "GTA 5", "Grand Theft Auto 5"], difficulty: "easy" },
  { steamAppId: 1293830, acceptedAnswers: ["Forza Horizon 4"], difficulty: "medium" },
  { steamAppId: 1551360, acceptedAnswers: ["Forza Horizon 5"], difficulty: "medium" },
  { steamAppId: 601150, acceptedAnswers: ["Devil May Cry 5", "DMC5", "DMC 5"], difficulty: "medium" },
  { steamAppId: 1091500, acceptedAnswers: ["Cyberpunk 2077", "Cyberpunk"], difficulty: "easy" }, // skip duplicate
  { steamAppId: 524220, acceptedAnswers: ["NieR: Automata", "Nier Automata", "NieR"], difficulty: "medium" },
  { steamAppId: 582010, acceptedAnswers: ["Monster Hunter: World", "Monster Hunter World", "MHW"], difficulty: "medium" },
  { steamAppId: 1446780, acceptedAnswers: ["Monster Hunter Rise", "MH Rise"], difficulty: "medium" },
  { steamAppId: 990080, acceptedAnswers: ["Hogwarts Legacy", "Hogwarts"], difficulty: "easy" },
  { steamAppId: 1817070, acceptedAnswers: ["Marvel's Spider-Man Remastered", "Spider-Man", "Spiderman"], difficulty: "easy" },
  { steamAppId: 1426210, acceptedAnswers: ["It Takes Two"], difficulty: "medium" },
  { steamAppId: 1332010, acceptedAnswers: ["Stray"], difficulty: "medium" },
  { steamAppId: 1203220, acceptedAnswers: ["Naraka: Bladepoint", "Naraka Bladepoint", "Naraka"], difficulty: "hard" },
  { steamAppId: 1229490, acceptedAnswers: ["Ultrakill", "ULTRAKILL"], difficulty: "hard" },
  { steamAppId: 648800, acceptedAnswers: ["Raft"], difficulty: "medium" },
  { steamAppId: 1817190, acceptedAnswers: ["Marvel's Spider-Man: Miles Morales", "Miles Morales", "Spider-Man Miles Morales"], difficulty: "medium" },
  { steamAppId: 1113560, acceptedAnswers: ["Ni no Kuni", "Ni no Kuni: Wrath of the White Witch"], difficulty: "hard" },
  { steamAppId: 739630, acceptedAnswers: ["Phasmophobia"], difficulty: "medium" },
  { steamAppId: 1262540, acceptedAnswers: ["Satisfactory"], difficulty: "medium" },
  { steamAppId: 1938090, acceptedAnswers: ["Call of Duty: Modern Warfare III", "COD MW3", "Modern Warfare 3", "Call of Duty MW3"], difficulty: "medium" },
  { steamAppId: 553850, acceptedAnswers: ["Helldivers 2", "Helldivers"], difficulty: "easy" },
  { steamAppId: 1203620, acceptedAnswers: ["V Rising"], difficulty: "hard" },
  { steamAppId: 594650, acceptedAnswers: ["Hunt: Showdown", "Hunt Showdown"], difficulty: "hard" },
  { steamAppId: 230410, acceptedAnswers: ["Warframe"], difficulty: "medium" },
  { steamAppId: 550, acceptedAnswers: ["Left 4 Dead 2", "L4D2", "Left 4 Dead"], difficulty: "medium" },
  { steamAppId: 431960, acceptedAnswers: ["Wallpaper Engine"], difficulty: "hard" },
  { steamAppId: 1144200, acceptedAnswers: ["Ready or Not"], difficulty: "hard" },
  { steamAppId: 394360, acceptedAnswers: ["Hearts of Iron IV", "HOI4", "Hearts of Iron 4"], difficulty: "hard" },
  { steamAppId: 289070, acceptedAnswers: ["Civilization VI", "Civilization 6", "Civ 6", "Civ VI"], difficulty: "medium" },
  { steamAppId: 236390, acceptedAnswers: ["War Thunder"], difficulty: "medium" },
];

// Remove duplicates by steamAppId
const uniqueGames = GAMES.filter(
  (game, index, self) => self.findIndex((g) => g.steamAppId === game.steamAppId) === index
);

function fetchJSON(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const doRequest = (reqUrl: string) => {
      https.get(reqUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doRequest(res.headers.location!);
          return;
        }
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", (err) => { fs.unlinkSync(dest); reject(err); });
    };
    doRequest(url);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const outputDir = path.resolve(__dirname, "../public/images/guessgame");
  const dataDir = path.resolve(__dirname, "../data/questions");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const questions: unknown[] = [];
  let idx = 0;

  for (const game of uniqueGames) {
    idx++;
    const id = `gg-${String(idx).padStart(3, "0")}`;
    const imgPath = path.join(outputDir, `${id}.jpg`);

    // Skip if image already downloaded
    if (fs.existsSync(imgPath)) {
      console.log(`[${idx}/${uniqueGames.length}] SKIP ${game.steamAppId} (already downloaded)`);
    } else {
      console.log(`[${idx}/${uniqueGames.length}] Fetching ${game.steamAppId}...`);
      try {
        const result = await fetchJSON(
          `https://store.steampowered.com/api/appdetails?appids=${game.steamAppId}`
        ) as Record<string, SteamAppDetails>;

        const details = result[String(game.steamAppId)];
        if (!details?.success || !details.data?.screenshots?.length) {
          console.warn(`  No screenshots for ${game.steamAppId}, skipping`);
          continue;
        }

        // Pick a screenshot (not the first one, which is often a logo/cinematic)
        const screenshots = details.data.screenshots;
        const ssIndex = Math.min(2, screenshots.length - 1);
        const ssUrl = screenshots[ssIndex].path_full;

        console.log(`  Downloading screenshot...`);
        await downloadFile(ssUrl, imgPath);

        // Add metadata from Steam
        const steamData = details.data;
        const genre = steamData.genres?.[0]?.description;
        const developer = steamData.developers?.[0];
        const releaseDate = steamData.release_date?.date;
        const releaseYear = releaseDate ? parseInt(releaseDate.split(", ").pop() || "", 10) || undefined : undefined;

        questions.push({
          id,
          type: "guessgame",
          imageUrl: `/images/guessgame/${id}.jpg`,
          gameTitle: steamData.name,
          acceptedAnswers: game.acceptedAnswers,
          genre: genre || undefined,
          releaseYear,
          developer: developer || undefined,
          difficulty: game.difficulty,
          timeLimit: 20,
          points: 100,
        });

        // Rate limit: Steam API is generous but let's be nice
        await sleep(1500);
      } catch (err) {
        console.error(`  Error fetching ${game.steamAppId}:`, err);
      }
    }

    // If image was already downloaded, still create the question entry
    if (fs.existsSync(imgPath) && !questions.find((q: any) => q.id === id)) {
      // Refetch metadata
      try {
        const result = await fetchJSON(
          `https://store.steampowered.com/api/appdetails?appids=${game.steamAppId}`
        ) as Record<string, SteamAppDetails>;
        const details = result[String(game.steamAppId)];
        if (details?.success) {
          const steamData = details.data;
          const genre = steamData.genres?.[0]?.description;
          const developer = steamData.developers?.[0];
          const releaseDate = steamData.release_date?.date;
          const releaseYear = releaseDate ? parseInt(releaseDate.split(", ").pop() || "", 10) || undefined : undefined;

          questions.push({
            id,
            type: "guessgame",
            imageUrl: `/images/guessgame/${id}.jpg`,
            gameTitle: steamData.name,
            acceptedAnswers: game.acceptedAnswers,
            genre: genre || undefined,
            releaseYear,
            developer: developer || undefined,
            difficulty: game.difficulty,
            timeLimit: 20,
            points: 100,
          });
          await sleep(1500);
        }
      } catch { /* skip */ }
    }
  }

  // Write questions JSON
  const jsonPath = path.join(dataDir, "guessgame.json");
  fs.writeFileSync(jsonPath, JSON.stringify(questions, null, 2), "utf-8");
  console.log(`\nDone! ${questions.length} questions written to ${jsonPath}`);

  // Write game titles list for frontend autocomplete
  const allTitles = new Set<string>();
  for (const q of questions as any[]) {
    allTitles.add(q.gameTitle);
    for (const ans of q.acceptedAnswers) {
      allTitles.add(ans);
    }
  }
  const titlesPath = path.join(dataDir, "guessgame-titles.json");
  fs.writeFileSync(titlesPath, JSON.stringify([...allTitles].sort(), null, 2), "utf-8");
  console.log(`${allTitles.size} game titles written to ${titlesPath}`);
}

main().catch(console.error);
