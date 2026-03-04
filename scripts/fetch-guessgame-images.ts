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

// Curated list of well-known games with Steam app IDs (~200 games)
const GAMES: GameEntry[] = [
  // === ORIGINAL 66 GAMES ===
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

  // === AAA STORY / ACTION ===
  { steamAppId: 1593500, acceptedAnswers: ["God of War", "God of War 2018"], difficulty: "easy" },
  { steamAppId: 1888930, acceptedAnswers: ["The Last of Us Part I", "The Last of Us", "TLOU"], difficulty: "easy" },
  { steamAppId: 2215430, acceptedAnswers: ["Ghost of Tsushima", "Ghost of Tsushima Director's Cut"], difficulty: "easy" },
  { steamAppId: 1259420, acceptedAnswers: ["Days Gone"], difficulty: "medium" },
  { steamAppId: 1190460, acceptedAnswers: ["Death Stranding"], difficulty: "medium" },
  { steamAppId: 1659420, acceptedAnswers: ["Uncharted: Legacy of Thieves", "Uncharted", "Uncharted 4"], difficulty: "easy" },
  { steamAppId: 2420110, acceptedAnswers: ["Horizon Forbidden West", "Horizon 2"], difficulty: "medium" },
  { steamAppId: 1172380, acceptedAnswers: ["Star Wars Jedi: Fallen Order", "Jedi Fallen Order"], difficulty: "easy" },
  { steamAppId: 1774580, acceptedAnswers: ["Star Wars Jedi: Survivor", "Jedi Survivor"], difficulty: "medium" },
  { steamAppId: 1649240, acceptedAnswers: ["Returnal"], difficulty: "hard" },
  { steamAppId: 2172430, acceptedAnswers: ["Ratchet & Clank: Rift Apart", "Ratchet and Clank"], difficulty: "medium" },
  { steamAppId: 1182900, acceptedAnswers: ["A Plague Tale: Requiem", "A Plague Tale 2"], difficulty: "medium" },
  { steamAppId: 752590, acceptedAnswers: ["A Plague Tale: Innocence", "A Plague Tale"], difficulty: "medium" },
  { steamAppId: 1472710, acceptedAnswers: ["Ghostwire: Tokyo", "Ghostwire Tokyo"], difficulty: "hard" },
  { steamAppId: 307690, acceptedAnswers: ["Sleeping Dogs"], difficulty: "medium" },

  // === RESIDENT EVIL ===
  { steamAppId: 1196590, acceptedAnswers: ["Resident Evil Village", "RE Village", "RE8"], difficulty: "medium" },
  { steamAppId: 883710, acceptedAnswers: ["Resident Evil 2", "RE2", "Resident Evil 2 Remake"], difficulty: "medium" },
  { steamAppId: 2050650, acceptedAnswers: ["Resident Evil 4", "RE4", "Resident Evil 4 Remake"], difficulty: "medium" },
  { steamAppId: 418370, acceptedAnswers: ["Resident Evil 7", "RE7", "Resident Evil 7: Biohazard"], difficulty: "medium" },

  // === SOULS-LIKE & ACTION RPG ===
  { steamAppId: 570940, acceptedAnswers: ["Dark Souls Remastered", "Dark Souls", "Dark Souls 1"], difficulty: "medium" },
  { steamAppId: 1627720, acceptedAnswers: ["Lies of P"], difficulty: "medium" },
  { steamAppId: 1325200, acceptedAnswers: ["Nioh 2"], difficulty: "hard" },
  { steamAppId: 2138710, acceptedAnswers: ["Sifu"], difficulty: "medium" },
  { steamAppId: 678960, acceptedAnswers: ["Code Vein"], difficulty: "hard" },
  { steamAppId: 1282100, acceptedAnswers: ["Remnant 2", "Remnant II"], difficulty: "medium" },
  { steamAppId: 617290, acceptedAnswers: ["Remnant: From the Ashes", "Remnant"], difficulty: "hard" },

  // === FPS ===
  { steamAppId: 782330, acceptedAnswers: ["Doom Eternal", "DOOM Eternal"], difficulty: "easy" },
  { steamAppId: 379720, acceptedAnswers: ["Doom", "DOOM", "Doom 2016"], difficulty: "medium" },
  { steamAppId: 1693980, acceptedAnswers: ["Dead Space", "Dead Space Remake"], difficulty: "medium" },
  { steamAppId: 1237970, acceptedAnswers: ["Titanfall 2", "Titanfall"], difficulty: "medium" },
  { steamAppId: 412020, acceptedAnswers: ["Metro Exodus", "Metro"], difficulty: "medium" },
  { steamAppId: 546560, acceptedAnswers: ["Half-Life: Alyx", "Half-Life Alyx", "HL Alyx"], difficulty: "medium" },
  { steamAppId: 220, acceptedAnswers: ["Half-Life 2", "HL2"], difficulty: "medium" },
  { steamAppId: 1139900, acceptedAnswers: ["Ghostrunner"], difficulty: "hard" },
  { steamAppId: 480490, acceptedAnswers: ["Prey", "Prey 2017"], difficulty: "hard" },
  { steamAppId: 403640, acceptedAnswers: ["Dishonored 2", "Dishonored"], difficulty: "hard" },
  { steamAppId: 1252330, acceptedAnswers: ["Deathloop"], difficulty: "medium" },
  { steamAppId: 8870, acceptedAnswers: ["BioShock Infinite", "Bioshock Infinite"], difficulty: "medium" },
  { steamAppId: 409710, acceptedAnswers: ["BioShock Remastered", "BioShock", "Bioshock"], difficulty: "medium" },
  { steamAppId: 359550, acceptedAnswers: ["Rainbow Six Siege", "R6 Siege", "R6S"], difficulty: "easy" },

  // === RPG ===
  { steamAppId: 377160, acceptedAnswers: ["Fallout 4"], difficulty: "easy" },
  { steamAppId: 22380, acceptedAnswers: ["Fallout: New Vegas", "Fallout New Vegas", "FNV"], difficulty: "medium" },
  { steamAppId: 489830, acceptedAnswers: ["Skyrim", "The Elder Scrolls V: Skyrim", "Skyrim Special Edition"], difficulty: "easy" },
  { steamAppId: 1716740, acceptedAnswers: ["Starfield"], difficulty: "medium" },
  { steamAppId: 632470, acceptedAnswers: ["Disco Elysium"], difficulty: "hard" },
  { steamAppId: 435150, acceptedAnswers: ["Divinity: Original Sin 2", "Divinity Original Sin 2", "DOS2"], difficulty: "medium" },
  { steamAppId: 1184370, acceptedAnswers: ["Pathfinder: Wrath of the Righteous", "Pathfinder WOTR"], difficulty: "hard" },
  { steamAppId: 2054970, acceptedAnswers: ["Dragon's Dogma 2", "Dragons Dogma 2"], difficulty: "medium" },
  { steamAppId: 367500, acceptedAnswers: ["Dragon's Dogma: Dark Arisen", "Dragon's Dogma", "Dragons Dogma"], difficulty: "hard" },
  { steamAppId: 740130, acceptedAnswers: ["Tales of Arise"], difficulty: "medium" },
  { steamAppId: 775500, acceptedAnswers: ["Scarlet Nexus"], difficulty: "hard" },

  // === YAKUZA / LIKE A DRAGON ===
  { steamAppId: 2072450, acceptedAnswers: ["Like a Dragon: Infinite Wealth", "Infinite Wealth"], difficulty: "medium" },
  { steamAppId: 1235140, acceptedAnswers: ["Yakuza: Like a Dragon", "Yakuza Like a Dragon"], difficulty: "medium" },
  { steamAppId: 638970, acceptedAnswers: ["Yakuza 0", "Yakuza Zero"], difficulty: "medium" },

  // === PERSONA / JRPG ===
  { steamAppId: 1687950, acceptedAnswers: ["Persona 5 Royal", "Persona 5", "P5R"], difficulty: "easy" },
  { steamAppId: 2161700, acceptedAnswers: ["Persona 3 Reload", "Persona 3", "P3R"], difficulty: "medium" },
  { steamAppId: 1113000, acceptedAnswers: ["Persona 4 Golden", "Persona 4", "P4G"], difficulty: "medium" },
  { steamAppId: 1462040, acceptedAnswers: ["Final Fantasy VII Remake", "FF7 Remake", "FF7R"], difficulty: "easy" },
  { steamAppId: 637650, acceptedAnswers: ["Final Fantasy XV", "FF15", "FFXV"], difficulty: "medium" },

  // === SURVIVAL / CRAFT ===
  { steamAppId: 242760, acceptedAnswers: ["The Forest"], difficulty: "medium" },
  { steamAppId: 1326470, acceptedAnswers: ["Sons of the Forest", "Sons of The Forest"], difficulty: "medium" },
  { steamAppId: 962130, acceptedAnswers: ["Grounded"], difficulty: "medium" },
  { steamAppId: 264710, acceptedAnswers: ["Subnautica"], difficulty: "easy" },
  { steamAppId: 848450, acceptedAnswers: ["Subnautica: Below Zero", "Subnautica Below Zero"], difficulty: "medium" },
  { steamAppId: 108600, acceptedAnswers: ["Project Zomboid"], difficulty: "medium" },
  { steamAppId: 361420, acceptedAnswers: ["Astroneer"], difficulty: "medium" },
  { steamAppId: 602960, acceptedAnswers: ["Barotrauma"], difficulty: "hard" },

  // === INDIE / ROGUELIKE ===
  { steamAppId: 504230, acceptedAnswers: ["Celeste"], difficulty: "medium" },
  { steamAppId: 268910, acceptedAnswers: ["Cuphead"], difficulty: "easy" },
  { steamAppId: 588650, acceptedAnswers: ["Dead Cells"], difficulty: "medium" },
  { steamAppId: 646570, acceptedAnswers: ["Slay the Spire"], difficulty: "medium" },
  { steamAppId: 311690, acceptedAnswers: ["Enter the Gungeon"], difficulty: "hard" },
  { steamAppId: 632360, acceptedAnswers: ["Risk of Rain 2", "Risk of Rain", "ROR2"], difficulty: "medium" },
  { steamAppId: 1145350, acceptedAnswers: ["Hades II", "Hades 2"], difficulty: "medium" },
  { steamAppId: 1313140, acceptedAnswers: ["Cult of the Lamb"], difficulty: "medium" },
  { steamAppId: 1942280, acceptedAnswers: ["Brotato"], difficulty: "hard" },
  { steamAppId: 881100, acceptedAnswers: ["Noita"], difficulty: "hard" },
  { steamAppId: 418530, acceptedAnswers: ["Spelunky 2", "Spelunky"], difficulty: "hard" },
  { steamAppId: 590380, acceptedAnswers: ["Into the Breach"], difficulty: "hard" },
  { steamAppId: 212680, acceptedAnswers: ["FTL", "FTL: Faster Than Light"], difficulty: "hard" },
  { steamAppId: 1092790, acceptedAnswers: ["Inscryption"], difficulty: "hard" },
  { steamAppId: 460950, acceptedAnswers: ["Katana ZERO", "Katana Zero"], difficulty: "hard" },
  { steamAppId: 219150, acceptedAnswers: ["Hotline Miami"], difficulty: "hard" },
  { steamAppId: 1533420, acceptedAnswers: ["Neon White"], difficulty: "hard" },
  { steamAppId: 1817230, acceptedAnswers: ["Hi-Fi Rush", "Hi-Fi RUSH"], difficulty: "medium" },

  // === PLATFORMER / METROIDVANIA ===
  { steamAppId: 261570, acceptedAnswers: ["Ori and the Blind Forest", "Ori"], difficulty: "medium" },
  { steamAppId: 1057090, acceptedAnswers: ["Ori and the Will of the Wisps"], difficulty: "medium" },
  { steamAppId: 553420, acceptedAnswers: ["Tunic"], difficulty: "hard" },
  { steamAppId: 607080, acceptedAnswers: ["Psychonauts 2", "Psychonauts"], difficulty: "hard" },

  // === NARRATIVE / WALKING SIM ===
  { steamAppId: 391540, acceptedAnswers: ["Undertale"], difficulty: "easy" },
  { steamAppId: 1150690, acceptedAnswers: ["Omori"], difficulty: "medium" },
  { steamAppId: 972660, acceptedAnswers: ["Spiritfarer"], difficulty: "hard" },
  { steamAppId: 753640, acceptedAnswers: ["Outer Wilds"], difficulty: "hard" },
  { steamAppId: 802130, acceptedAnswers: ["Return of the Obra Dinn", "Obra Dinn"], difficulty: "hard" },
  { steamAppId: 383870, acceptedAnswers: ["Firewatch"], difficulty: "medium" },
  { steamAppId: 1703340, acceptedAnswers: ["The Stanley Parable", "The Stanley Parable: Ultra Deluxe"], difficulty: "medium" },
  { steamAppId: 1049410, acceptedAnswers: ["Superliminal"], difficulty: "hard" },

  // === SIMULATION / BUILDER / STRATEGY ===
  { steamAppId: 294100, acceptedAnswers: ["RimWorld", "Rimworld"], difficulty: "medium" },
  { steamAppId: 427520, acceptedAnswers: ["Factorio"], difficulty: "medium" },
  { steamAppId: 1366540, acceptedAnswers: ["Dyson Sphere Program", "DSP"], difficulty: "hard" },
  { steamAppId: 255710, acceptedAnswers: ["Cities: Skylines", "Cities Skylines"], difficulty: "easy" },
  { steamAppId: 949230, acceptedAnswers: ["Cities: Skylines II", "Cities Skylines 2"], difficulty: "medium" },
  { steamAppId: 227300, acceptedAnswers: ["Euro Truck Simulator 2", "ETS2"], difficulty: "medium" },
  { steamAppId: 281990, acceptedAnswers: ["Stellaris"], difficulty: "hard" },
  { steamAppId: 1158310, acceptedAnswers: ["Crusader Kings III", "Crusader Kings 3", "CK3"], difficulty: "hard" },
  { steamAppId: 236850, acceptedAnswers: ["Europa Universalis IV", "EU4"], difficulty: "hard" },
  { steamAppId: 1142710, acceptedAnswers: ["Total War: Warhammer III", "Total War Warhammer 3", "Warhammer 3"], difficulty: "hard" },
  { steamAppId: 1466860, acceptedAnswers: ["Age of Empires IV", "Age of Empires 4", "AOE4"], difficulty: "medium" },
  { steamAppId: 261550, acceptedAnswers: ["Mount & Blade II: Bannerlord", "Bannerlord", "Mount and Blade 2"], difficulty: "medium" },

  // === COOP / MULTIPLAYER ===
  { steamAppId: 548430, acceptedAnswers: ["Deep Rock Galactic", "DRG"], difficulty: "medium" },
  { steamAppId: 552500, acceptedAnswers: ["Warhammer: Vermintide 2", "Vermintide 2"], difficulty: "hard" },
  { steamAppId: 1361210, acceptedAnswers: ["Warhammer 40,000: Darktide", "Darktide", "Warhammer Darktide"], difficulty: "hard" },
  { steamAppId: 381210, acceptedAnswers: ["Dead by Daylight", "DBD"], difficulty: "easy" },
  { steamAppId: 252950, acceptedAnswers: ["Rocket League"], difficulty: "easy" },
  { steamAppId: 1097150, acceptedAnswers: ["Fall Guys"], difficulty: "easy" },
  { steamAppId: 477160, acceptedAnswers: ["Human: Fall Flat", "Human Fall Flat"], difficulty: "medium" },
  { steamAppId: 285900, acceptedAnswers: ["Gang Beasts"], difficulty: "medium" },
  { steamAppId: 728880, acceptedAnswers: ["Overcooked! 2", "Overcooked 2", "Overcooked"], difficulty: "medium" },
  { steamAppId: 1172620, acceptedAnswers: ["Sea of Thieves"], difficulty: "easy" },

  // === FIGHTING ===
  { steamAppId: 976310, acceptedAnswers: ["Mortal Kombat 11", "MK11"], difficulty: "easy" },
  { steamAppId: 1364780, acceptedAnswers: ["Street Fighter 6", "SF6"], difficulty: "easy" },
  { steamAppId: 1778820, acceptedAnswers: ["Tekken 8"], difficulty: "medium" },
  { steamAppId: 678950, acceptedAnswers: ["Dragon Ball FighterZ", "DBFZ"], difficulty: "medium" },
  { steamAppId: 1384160, acceptedAnswers: ["Guilty Gear Strive", "GGST", "Guilty Gear -Strive-"], difficulty: "hard" },

  // === HORROR ===
  { steamAppId: 238320, acceptedAnswers: ["Outlast"], difficulty: "medium" },
  { steamAppId: 414700, acceptedAnswers: ["Outlast 2"], difficulty: "hard" },
  { steamAppId: 214490, acceptedAnswers: ["Alien: Isolation", "Alien Isolation"], difficulty: "medium" },
  { steamAppId: 57300, acceptedAnswers: ["Amnesia: The Dark Descent", "Amnesia"], difficulty: "hard" },

  // === BORDERLANDS ===
  { steamAppId: 397540, acceptedAnswers: ["Borderlands 3"], difficulty: "easy" },

  // === MMO / ONLINE ===
  { steamAppId: 238960, acceptedAnswers: ["Path of Exile", "POE"], difficulty: "medium" },
  { steamAppId: 1599340, acceptedAnswers: ["Lost Ark"], difficulty: "medium" },
  { steamAppId: 1063730, acceptedAnswers: ["New World"], difficulty: "hard" },

  // === METAL GEAR / STEALTH ===
  { steamAppId: 287700, acceptedAnswers: ["Metal Gear Solid V", "MGSV", "Metal Gear Solid V: The Phantom Pain"], difficulty: "medium" },
  { steamAppId: 1659040, acceptedAnswers: ["Hitman 3", "Hitman: World of Assassination", "Hitman WoA"], difficulty: "medium" },

  // === WARHAMMER / SPACE MARINE ===
  { steamAppId: 2183900, acceptedAnswers: ["Warhammer 40,000: Space Marine 2", "Space Marine 2"], difficulty: "medium" },

  // === MISC POPULAR ===
  { steamAppId: 239140, acceptedAnswers: ["Dying Light"], difficulty: "medium" },
  { steamAppId: 534380, acceptedAnswers: ["Dying Light 2", "Dying Light 2 Stay Human"], difficulty: "medium" },
  { steamAppId: 870780, acceptedAnswers: ["Control"], difficulty: "hard" },
  { steamAppId: 233860, acceptedAnswers: ["Kenshi"], difficulty: "hard" },
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
        await sleep(800);
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
          await sleep(800);
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
